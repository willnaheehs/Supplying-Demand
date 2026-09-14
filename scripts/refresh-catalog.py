"""Rebuild the sourced catalog from pinned MLCommons repositories (Python stdlib).

Usage: python3 scripts/refresh-catalog.py [--cache /tmp/sd-catalog-research]
Sampling is deterministic and independent of performance: round-robin by
submitter, then model/scenario. Raw logs and system metadata must be retrievable.
Training entries are single successful trials, NEVER official aggregate scores.
"""
import argparse
from collections import defaultdict, deque, Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.request
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
PINS = {
    'inference_results_v5.0': '0bc17ab3f4b33f730d7869e04cc29cb70835e513',
    'inference_results_v5.1': '5ea4f62ef62536e6bf4d78a9b440fb9035ddfb4a',
    'inference_results_v6.0': '4d3916ac9cf474b679cdfcf492d43a0559418ad1',
    'training_results_v5.0': 'd7e703fccc1c86e70cb31bac108f99072e34dba0',
    'training_results_v5.1': '441d65f4445cd59687466533fd9f55399136e7a4',
    'training_results_v6.0': 'eabf23a07b2a0c60a289ff871dc3a46fff0d0421',
}
parser = argparse.ArgumentParser()
parser.add_argument('--cache', default='/tmp/sd-catalog-research')
args = parser.parse_args()
CACHE = Path(args.cache)
CACHE.mkdir(parents=True, exist_ok=True)
REVIEWED = date.today().isoformat()


def fetch(url):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.txt')
    if path.exists():
        return path.read_text()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'SupplyingDemand-catalog/1.0'}), timeout=35) as r:
                text = r.read().decode()
            path.write_text(text)
            return text
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def raw(repo, path):
    return f'https://raw.githubusercontent.com/mlcommons/{repo}/{PINS[repo]}/' + urllib.parse.quote(path, safe='/')


def source(repo, path, title):
    return {'title': title, 'url': f'https://github.com/mlcommons/{repo}/blob/{PINS[repo]}/' + urllib.parse.quote(path, safe='/')}


def clean(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        value = json.dumps(value, separators=(',', ':'))
    value = str(value).strip()
    return None if value.lower() in ('', 'n/a', 'na', 'none', 'unknown', 'not applicable') else value


def integer(value):
    try:
        num = float(value)
        return int(num) if num > 0 and num.is_integer() else None
    except (ValueError, TypeError):
        return None


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()[:18]


def hardware(system):
    nodes = integer(system.get('number_of_nodes'))
    per_node = integer(system.get('accelerators_per_node'))
    gpu = clean(system.get('accelerator_model_name')) or 'CPU / accelerator not specified'
    count = nodes * per_node if nodes and per_node else None
    count_note = 'Calculated from reported nodes × accelerators per node.' if count else None
    embedded = re.search(r'\(x(\d+)\)', gpu, re.I)
    if embedded and count and int(embedded.group(1)) != count:
        count = None
        count_note = 'Submission label and nodes × accelerators per node disagree; total left unknown.'
    return {
        'accelerator': gpu, 'acceleratorCount': count, 'nodes': nodes,
        'acceleratorsPerNode': per_node, 'countNote': count_note,
        'acceleratorMemory': clean(system.get('accelerator_memory_capacity')),
        'cpu': clean(system.get('host_processor_model_name')),
        'cpusPerNode': integer(system.get('host_processors_per_node')),
        'ram': clean(system.get('host_memory_capacity')),
        'localStorage': clean(' · '.join(filter(None, [clean(system.get('host_storage_type')), clean(system.get('host_storage_capacity'))]))),
        'sharedStorage': None, 'storageServers': None,
        'scaleUp': clean(system.get('accelerator_interconnect')),
        'network': clean(system.get('host_networking')),
        'topology': clean(system.get('host_networking_topology')),
        'frontend': None,
    }


def balanced(items, limit, key):
    groups = defaultdict(list)
    for item in items:
        groups[key(item)[0]].append(item)
    queues = {}
    for vendor, group in groups.items():
        subgroups = defaultdict(deque)
        for item in sorted(group, key=lambda x: str(x)):
            subgroups[key(item)[1]].append(item)
        order = []
        while any(subgroups.values()):
            for name in sorted(subgroups):
                if subgroups[name]:
                    order.append(subgroups[name].popleft())
        queues[vendor] = deque(order)
    selected = []
    while len(selected) < limit and any(queues.values()):
        for vendor in sorted(queues):
            if queues[vendor] and len(selected) < limit:
                selected.append(queues[vendor].popleft())
    return selected


def inference(repo, row):
    path = row['Location'].removeprefix('./')
    if not path.endswith('run_1'):
        path += '/performance/run_1'
    logpath = path + '/mlperf_log_summary.txt'
    log = fetch(raw(repo, logpath))
    if not re.search(r'Result is\s*:\s*VALID\b', log):
        raise ValueError('Log is not VALID')
    syspath = f"closed/{row['Submitter']}/systems/{row['Platform']}.json"
    system = json.loads(fetch(raw(repo, syspath)))
    def num(pattern, scale=1):
        match = re.search(pattern, log, re.I)
        return round(float(match.group(1)) / scale, 6) if match else None
    value = float(row['Performance_Result'])
    unit = row['Performance_Units']
    if unit == 'Tokens/s':
        value = num(r'Completed tokens per second\s*:\s*([\d.eE+-]+)') or value
    version = repo.split('_')[-1]
    precision = clean(row.get('weight_data_types'))
    return {
        'id': 'mlperf-' + digest(repo + ':' + path),
        'systemId': 'system-' + digest(row['Submitter'].lower() + ':' + row['Platform']),
        'name': clean(row.get('System')) or row['Platform'], 'operator': row['Submitter'],
        'evidenceKind': 'benchmark', 'workloadKind': 'inference',
        'model': row['Model'], 'scenario': row['Scenario'], 'precision': precision,
        'date': None, 'reviewedAt': REVIEWED, 'suite': 'MLPerf Inference ' + version,
        'hardware': hardware(system), 'software': clean(row.get('Software')),
        'metric': {'name': 'Throughput', 'value': value, 'unit': unit, 'direction': 'higher'},
        'ttftP99Ms': num(r'99\.00 percentile first token latency \(ns\)\s*:\s*([\d.eE+-]+)', 1e6),
        'tpotP99Ms': num(r'99\.00 percentile time to output token \(ns\)\s*:\s*([\d.eE+-]+)', 1e6),
        'conditions': f"{version} closed division · {row['Scenario']} · {row['Model']} · weights {precision or 'not disclosed'}. Accuracy: {clean(row.get('Accuracy')) or 'See submission.'}",
        'outcome': f"The submitted system completed a VALID {row['Scenario']} run of {row['Model']} at {value:,.3f} {unit}.",
        'limitation': 'Applies to this benchmark, software and test workload only. A submitted system is not proof of current production use or capacity available to rent. Network metadata may mix network roles; shared storage and frontend are not inferred.',
        'sources': [source(repo, logpath, 'VALID performance log'), source(repo, syspath, 'System configuration'), source(repo, 'summary_results.json', 'Official results table')],
        'origin': 'seed',
    }


def training(repo, path):
    vendor, _, platform, model, _ = path.split('/')
    syspath = f'{vendor}/systems/{platform}.json'
    system = json.loads(fetch(raw(repo, syspath)))
    if system.get('division', '').lower() != 'closed':
        raise ValueError('Not closed division')
    log = fetch(raw(repo, path))
    events = []
    for line in log.splitlines():
        if ':::MLLOG ' in line:
            try:
                events.append(json.loads(line.split(':::MLLOG ', 1)[1]))
            except json.JSONDecodeError:
                pass
    start = next((x for x in events if x.get('key') == 'run_start'), None)
    stop = next((x for x in events if x.get('key') == 'run_stop' and x.get('metadata', {}).get('status') == 'success'), None)
    if not start or not stop or stop['time_ms'] <= start['time_ms']:
        raise ValueError('No successful timed trial')
    minutes = round((stop['time_ms'] - start['time_ms']) / 60000, 6)
    accuracy = [x for x in events if x.get('key') == 'eval_accuracy']
    batch = next((x.get('value') for x in events if x.get('key') == 'global_batch_size'), None)
    version = repo.split('_')[-1]
    return {
        'id': 'mlperf-trial-' + digest(repo + ':' + path),
        'systemId': 'system-' + digest(vendor.lower() + ':' + platform),
        'name': clean(system.get('system_name')) or platform, 'operator': vendor,
        'evidenceKind': 'training-trial', 'workloadKind': 'training', 'model': model,
        'scenario': 'Single training trial', 'precision': None,
        'date': None, 'reviewedAt': REVIEWED, 'suite': 'MLPerf Training ' + version,
        'hardware': hardware(system), 'software': clean(system.get('framework')),
        'metric': {'name': 'Successful trial duration', 'value': minutes, 'unit': 'minutes', 'direction': 'lower'},
        'ttftP99Ms': None, 'tpotP99Ms': None,
        'conditions': f"Closed division {version}, {model}, {path.rsplit('/', 1)[-1]}. Global batch: {batch or 'not logged'}. Final eval_accuracy field: {accuracy[-1].get('value') if accuracy else 'not logged'} (metric meaning is workload-specific).",
        'outcome': f"One trial logged run_stop=success after {minutes:,.3f} minutes (run_stop minus run_start).",
        'limitation': 'Single successful trial, not the official MLPerf aggregate score. MLPerf trains or fine-tunes to a defined quality target, often from a supplied checkpoint; this is not full foundation-model pretraining time. See benchmark rules and run configuration.',
        'sources': [source(repo, path, 'Successful training trial log'), source(repo, syspath, 'System configuration'), {'title': 'Training benchmark definitions', 'url': 'https://github.com/mlcommons/training/tree/master'}],
        'origin': 'seed',
    }


records, reports = [], []
for repo, revision in PINS.items():
    if repo.startswith('inference'):
        # Cached research summaries are only reused when their pin matches.
        cached = CACHE / f'{repo}-summary.json'
        index = CACHE / f'{repo}-index.json'
        use_cached = cached.exists() and index.exists() and json.loads(index.read_text()).get('revision') == revision
        rows = json.loads(cached.read_text() if use_cached else fetch(raw(repo, 'summary_results.json')))
        unique = {}
        for row in rows:
            if row.get('Category') != 'closed' or row.get('Suite') != 'datacenter' or row.get('errors') != 0 or row.get('Scenario') not in ('Server', 'Offline', 'Interactive'):
                continue
            if not row.get('Performance_Result') or row.get('has_power') or not row.get('compliance'):
                continue
            unique.setdefault(row['Location'].removeprefix('./'), row)
        eligible = list(unique.values())
        selected = balanced(eligible, 180, lambda x: (x['Submitter'], x['Model'] + ':' + x['Scenario']))
        convert = inference
    else:
        cached = CACHE / f'{repo}-tree.json'
        tree = json.loads(cached.read_text() if cached.exists() else fetch(f'https://api.github.com/repos/mlcommons/{repo}/git/trees/{revision}?recursive=1'))
        if tree.get('sha') != revision or tree.get('truncated'):
            raise ValueError('Tree pin mismatch or incomplete tree: ' + repo)
        eligible = [x['path'] for x in tree['tree'] if re.fullmatch(r'[^/]+/results/[^/]+/[^/]+/result_0\.txt', x['path'])]
        selected = balanced(eligible, 40, lambda x: (x.split('/')[0], x.split('/')[3]))
        convert = training
    failures = []
    def work(item):
        try:
            return convert(repo, item)
        except Exception as exc:
            failures.append({'path': item.get('Location') if isinstance(item, dict) else item, 'reason': str(exc)[:200]})
            return None
    with ThreadPoolExecutor(max_workers=8) as pool:
        batch = [r for r in pool.map(work, selected) if r]
    records.extend(batch)
    reports.append({'repository': repo, 'revision': revision, 'eligible': len(eligible), 'selected': len(selected), 'included': len(batch), 'excluded': sorted(failures, key=lambda x: x['path'])})
    print(f'{repo}: {len(batch)}/{len(selected)} included, {len(failures)} excluded', flush=True)

curated = ROOT / 'data/cluster-deployments.json'
if curated.exists():
    records.extend(json.loads(curated.read_text()))
records.sort(key=lambda x: (x['origin'] != 'seed', x['evidenceKind'], x['operator'].lower(), x['model'], x['id']))
assert len({r['id'] for r in records}) == len(records)
(ROOT / 'data/cluster-catalog.json').write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n')
manifest = {
    'schemaVersion': 1, 'reviewedAt': REVIEWED,
    'revision': digest(json.dumps(records, sort_keys=True)),
    'recordCount': len(records), 'systemCount': len({x['systemId'] for x in records}),
    'operators': len({x['operator'].lower() for x in records}),
    'kinds': dict(Counter(x['evidenceKind'] for x in records)), 'repositories': reports,
    'method': 'Up to 180 inference records and 40 result_0 training trials per pinned release. Deterministic round-robin by submitter, then model/scenario; selection does not use performance. Inference: closed datacenter, errors=0, compliance present, no power variants, unique result path, raw log VALID. Training: closed division and run_stop=success. Missing logs/metadata are excluded. Operator/research entries are curated separately.',
    'counting': 'Records are workload observations. Systems group submitter + platform identifiers across releases; identifiers may describe a configuration, not a unique physical installation. Do not sum accelerator counts across observations. This is a historical evidence sample, not a census or live inventory.',
}
(ROOT / 'data/catalog-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({k: manifest[k] for k in ('recordCount', 'systemCount', 'operators', 'kinds')}))
