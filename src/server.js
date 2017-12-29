const http = require('http');
const urllib = require('url')
const puppeteer = require('puppeteer');

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type':'application/json'});
    
    const query = urllib.parse(req.url, true).query;
    const url = query['url'];
    const selector = query['selector'];

    if (url == undefined || selector == undefined){
        msg = 'parameter `url` or `selector` missing';
        res.write(JSON.stringify({code:-1, err:msg}));
        res.end();
        return;
    }

    console.log('request: ' + req.url);

    (async () => {
        try {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            const viewport = {width:1920, height:1080}
    
            await page.setViewport(viewport);
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
