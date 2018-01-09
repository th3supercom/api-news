import sys, requests, json, os, time, urllib
from multiprocessing.dummy import Pool as ThreadPool

if len(sys.argv) < 3:
    print 'Usage: python puppeteer.py config output'
    sys.exit()

# read config
fns = sys.argv[1].split(',')
for fn in fns:
    if not os.path.isfile(fn):
        print when(), 'error [', fn, '] not exists'
        sys.exit()

configs = {}
for fn in fns:
    fin = open(fn)
    for line in fin:
        j = json.loads(line.strip())
        if 'url' in j and 'selector' in j:
            configs[j['url']] = j
        else:
            print when(), 'error [', fn, '] config:', line.strip()
    fin.close()
configs = configs.values()
configs.sort(key=lambda x:x['url'])

# ensure output dir
ts = int(time.time())
fn = sys.argv[2] + os.sep + time.strftime("%Y-%m-%d", time.localtime(ts))
if not os.path.isdir(fn):
    os.makedirs(fn)

# print datetime
def when():
  return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))

# get json from url, retry=3
def getJson(url):
    for i in range(1,-1,-1):
        try:
            r = requests.get(url, timeout=30)
            return json.loads(r.content)
        except Exception, e:
            if i == 0:
                print when(), e
                return {}

# get docid from norm url
def getDocid(url):
    normurl = 'http://172.31.20.133:10001/norm?url=' + urllib.quote(url)
    r = getJson(normurl)
    if 'result' in r and len(r['result']) > 0:
        url = r['result'][0]
    return getJson(url)

for config in configs:
    url = urllib.quote(config['url'])
    selector = urllib.quote(config['selector'])
    waitfor = config['waitfor'] if 'waitfor' in config else 0

    host = url[url.find('//')+2:]
    if host.startswith('www.'):
        host = host[4:]
    print ''
    print when(), '>>> process host [', host, ']'
    rect_output = fn + os.sep + '.'.join(['rect', host, str(ts)])
    score_output = fn + os.sep + '.'.join(['score', host, str(ts)])
    try:
        ts_start = time.time()

        # get url rect and write to file rect.host.ts 
        r = getJson('http://172.24.22.73:8888/parse?url=%s&selector=%s&waitfor=%d' % (url,selector,waitfor))
        if 'links' in r and len(r['links']) > 0:
            r['ts'] = ts
            fout = open(rect_output, 'w')
            fout.write(json.dumps(r))
            fout.close()
            print when(), 'write to file [', rect_output, ']'
        else:
            print when(), 'error', r
            continue
        # get max/min y and area
        links = {}
        for link in r['links']:
            ln = link['url']
            if ln in links:
                links[ln]['y'] = min(links[ln]['y'], link['rect'][1])
                links[ln]['area'] += link['rect'][2]*link['rect'][3]
            else:
                links[ln] = {'url':ln,'y':link['rect'][1],'area':link['rect'][2]*link['rect'][3]}
        links = links.values()
        y = [float(link['y']) for link in links]
        area = [float(link['area']) for link in links]
        ymin,ymax,amin,amax = min(y),max(y),min(area),max(area)
        # scoring
        result = {}
        for link in links:
            scores = {'y':1.0-(link['y']-ymin)/(ymax-ymin), 'area':(link['area']-amin)/(amax-amin)}
            avg = sum(scores.values()) / len(scores)
            result[link['url']] = (avg, scores)
        print when(), 'complete scoring for [', len(result), '] links'
        # find docids
        urls = result.keys()
        urls = ['http://172.31.4.8:6001/id/find?token=d01bbc072c2e7376801d9aa0eb89f95a&url='+urllib.quote(x) for x in urls]
        pool = ThreadPool(10)
        docs = pool.map(getDocid, urls)
        pool.close()
        pool.join()
        url2docid = {}
        for doc in docs:
            if 'result' in doc:
                url2docid[doc['result']['url']] = doc['result']['_id']
        print when(), 'complete querying docids for [', len(urls), '] links'
        # write to file score.host.ts
        result = result.items()
        result.sort(key=lambda x:x[1], reverse=True)
        links = []
        for k,v in result:
            docid = url2docid[k] if k in url2docid else None
            data = {'url':k,'docid':docid,'score':v[0],'explain':v[1]}
            links.append(data)
        fout = open(score_output,'w')
        fout.write(json.dumps({'code':0,'url':url,'links':links,'ts':ts}))
        fout.close()
        print when(), 'write to file [', score_output, "]"

        ts_end = time.time()
        print when(), 'time:', ts_end-ts_start, 'sec'
        
    except Exception, e:
        print when(), e
