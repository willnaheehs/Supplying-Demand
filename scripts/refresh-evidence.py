"""Refresh pinned, public MLPerf records used by the cluster lab (no credentials)."""
import json, re, urllib.request
from pathlib import Path
REVISIONS={'v5.0':'0bc17ab3f4b33f730d7869e04cc29cb70835e513','v6.0':'4d3916ac9cf474b679cdfcf492d43a0559418ad1'}
PLATFORMS={'v5.0':'DGX-H100_H100-SXM-80GBx8_TRT','v6.0':'B300-SXM-270GBx8_TRT'}
def fetch(url):
    return urllib.request.urlopen(url,timeout=30).read().decode()
records=[]
for version,revision in REVISIONS.items():
    base=f'https://raw.githubusercontent.com/mlcommons/inference_results_{version}/{revision}'
    rows=json.loads(fetch(base+'/summary_results.json'))
    platform=PLATFORMS[version]
    system_path=f'closed/NVIDIA/systems/{platform}.json'
    system=json.loads(fetch(base+'/'+system_path))
    for row in rows:
        if row['Submitter']!='NVIDIA' or row['Category']!='closed' or row['Platform']!=platform or row['Model']!='llama2-70b-99': continue
        path=row['Location'].removeprefix('./')
        if not path.endswith('run_1'): path+='/performance/run_1'
        logfile=path+'/mlperf_log_summary.txt'
        log=fetch(base+'/'+logfile)
        def val(pattern,scale=1):
            match=re.search(pattern,log,re.IGNORECASE)
            return round(float(match.group(1))/scale,5) if match else None
        assert 'Result is : VALID' in log, logfile
        record={
          'id':row['ID']+'-'+row['Scenario'].lower(),'submissionId':row['ID'],'version':version,'revision':revision,
          'published':'2025-04-02' if version=='v5.0' else '2026-04-01','reviewed':'2026-09-12',
          'system':row['System'],'gpu':'H100' if version=='v5.0' else 'B300','nodes':row['Nodes'],'gpusPerNode':row['a#'],
          'model':row['Model'],'scenario':row['Scenario'],'precision':row['weight_data_types'],
          'tokensPerSecond':val(r'Completed tokens per second\s*:\s*([\d.]+)') or row['Performance_Result'],
          'summaryTokensPerSecond':row['Performance_Result'],'unit':row['Performance_Units'],
          'ttftP99Ms':val(r'99\.00 percentile first token latency \(ns\)\s*:\s*([\d.]+)',1e6),
          'tpotP99Ms':val(r'99\.00 percentile time to output token \(ns\)\s*:\s*([\d.]+)',1e6),
          'ttftLimitMs':val(r'ttft_latency \(ns\):\s*([\d.]+)',1e6),'tpotLimitMs':val(r'tpot_latency \(ns\):\s*([\d.]+)',1e6),
          'software':row['Software'],'accuracy':row['Accuracy'],'dataset':'OpenOrca','systemMetadata':system,
          'sourceUrl':f'https://github.com/mlcommons/inference_results_{version}/blob/{revision}/{logfile}',
          'systemUrl':f'https://github.com/mlcommons/inference_results_{version}/blob/{revision}/{system_path}',
          'summaryUrl':f'https://github.com/mlcommons/inference_results_{version}/blob/{revision}/summary_results.json',
        }
        records.append(record)
output=Path(__file__).resolve().parents[1]/'data/mlperf-snapshot.json'
output.write_text(json.dumps(records,indent=2)+'\n')
print(f'Wrote {len(records)} validated public benchmark records.')
