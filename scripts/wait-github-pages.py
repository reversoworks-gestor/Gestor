import json, subprocess, time, sys, urllib.request, re
repo = 'reversoworks-gestor/Gestor'
expected = sys.argv[1]
url = 'https://reversoworks-gestor.github.io/Gestor/'
ansi = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
for attempt in range(60):
    result = subprocess.run(['gh','api',f'repos/{repo}/pages/builds/latest'],capture_output=True,text=True)
    if result.returncode == 0:
        build = json.loads(ansi.sub('', result.stdout))
        print(f"Pages: status={build.get('status')} commit={build.get('commit','')[:7]}", flush=True)
        if build.get('commit') == expected and build.get('status') == 'errored':
            raise SystemExit(f"Pages deployment failed: {build.get('error')}")
        if build.get('commit') == expected and build.get('status') == 'built':
            req = urllib.request.Request(url+'?release='+expected[:12],headers={'Cache-Control':'no-cache'})
            try:
                with urllib.request.urlopen(req,timeout=20) as response:
                    html = response.read().decode()
                    if response.status == 200 and 'Reverso Gestor — Automotive Studio' in html and '/Gestor/assets/' in html:
                        print('Published URL confirmed: '+url, flush=True)
                        print(json.dumps(build), flush=True)
                        raise SystemExit(0)
            except (OSError, UnicodeError) as error:
                print('Waiting for CDN: '+str(error), flush=True)
    else:
        print('Waiting for Pages build registration', flush=True)
    time.sleep(10)
raise SystemExit('Timeout while waiting for this Pages build; no duplicate deployment was submitted.')
