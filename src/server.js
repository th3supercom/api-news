const fs = require('fs');
const http = require('http');
const urllib = require('url')
const puppeteer = require('puppeteer');
const dateFormat = require('dateformat');

const server = http.createServer((req, res) => {
    console.log('request: ' + req.url);
    res.writeHead(200, {'Content-Type':'application/json'});
    
    const parse = urllib.parse(req.url, true);
    const path = parse.pathname;
    const query = parse.query;
    
    if (path == '/parse'){
        _parse(query, res);
    }
    else if (path == '/rect'){
        _serve(query, res, 'rect');
    }
    else if (path == '/score'){
        _serve(query, res, 'score');
    }
    else{
        res.write(JSON.stringify({code:0}));
        res.end();
    }
});

const _serve = ((query, res, prefix) => {
    const host = query['host'];

    if (host == undefined){
        msg = 'parameter `host` missing';
        res.write(JSON.stringify({code:-1, err:msg}));
        res.end();
        return;
    }
    
    const root = '/home/services/puppeteer/data/scores/';
    const fn = prefix + '.' + host;

    let now = new Date(), path = '', file = '';
    for (let i=0; i<7; i++){
        path = root + dateFormat(now, 'isoDate');
        if (fs.existsSync(path)){
            const files = fs.readdirSync(path);
            for (let j=0; j<files.length; j++)
                if (files[j].startsWith(fn) && files[j] > file)
                    file = files[j];
            if (file != '') break;
        }
        now.setDate(now.getDate() - 1);
    }
    
    if (file != ''){
        content = fs.readFileSync(path + '/' + file);
        res.write(content);
        res.end();
    }
    else{
        msg = 'file ' + fn + ' not found';
        res.write(JSON.stringify({code:-1, err:msg}));
        res.end();
    }
});

const _parse = ((query, res) => {
    const url = query['url'];
    const selector = query['selector'];

    if (url == undefined || selector == undefined){
        msg = 'parameter `url` or `selector` missing';
        res.write(JSON.stringify({code:-1, err:msg}));
        res.end();
        return;
    }

    (async () => {
        try {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            const viewport = {width:1920, height:1080}
    
            await page.setViewport(viewport);
            //await page.goto(url);
            await page.goto(url, {'waitUntil':'domcontentloaded'});
            await page.waitForFunction(selector => {
                return document.querySelectorAll(selector).length >= 20;
            }, {}, selector);
            //await page.waitFor(10000);
    
            const links = await page.$$eval(selector, links => {
                return Array.from(links).map(link => {
                    const rect = link.getBoundingClientRect();
                    return {url:link.href,rect:[rect.x,rect.y,rect.width,rect.height],html:link.outerHTML};
                }).filter(link => link.rect[2]>0 && link.rect[3]>0);
            });

            await page.close();
            await browser.close();
    
            res.write(JSON.stringify({code:0,url:url,selector:selector,viewport:page.viewport(),links:links}));
            res.end();
        }
        catch (e){
            console.log(e);
            res.write(JSON.stringify({code:-1,err:e.message}));
            res.end();
        }
    })();
});

server.listen(8888);

console.log('Node.js runing on port 8888');
