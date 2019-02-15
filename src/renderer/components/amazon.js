import { EventEmitter } from 'events';

const puppeteer = require('puppeteer');

import Good from './good.js'
import Response from './response.js';

export default class Amazon extends EventEmitter {
    constructor(url, zip, ws){
        super();
        this.url = url;
        this.zip = zip;
        // this.ws = ws;
        this.browser = null;
        this.page = null;
        this.result = [];
        this.goodPage = null;
        this.closed = false;
        this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1';
    }

    async open(){
        function getChromiumExecPath() {
            return puppeteer.executablePath().replace('app.asar', 'app.asar.unpacked');
        }
        console.log('EXEC PATH: ', puppeteer.executablePath());
        this.browser = await puppeteer.launch({
            // headless : false,
            executablePath : getChromiumExecPath(),
            args : [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({
            width : 375,
            height : 812,
            isMobile : true,
            hasTouch : true
        });

        // const context = this.browser.defaultBrowserContext();
        // await context.overridePermissions('https://www.amazon.com', ['geolocation']);
        // await this.page.setGeolocation({latitude : 32.606340, longitude : -85.491280});

        this.page.setUserAgent(this.userAgent);
        this.page.setDefaultNavigationTimeout(60000);

        await this.page.setRequestInterception(true);
        let ignoreElements = ['image']; //'stylesheet', 'font', 'script'
        this.page.on('request', (req) => {
            if(ignoreElements.indexOf(req.resourceType()) !== -1){
                req.abort();
            }
            else {
                req.continue();
            }
        });

        try {
            await this.page.goto(this.url, {waitFor : 'domcontentloaded'});
            return true;
        } catch (err) {
            // this.ws.send(JSON.stringify(new Response(false, 'URL is not correct')));
            this.emit('error', 'URL is not correct')
            return false;
        }
    }

    async close(){
        await this.browser.close();
        console.log('BROWSER CLOSED');
    }

    async changeLocation(){
        if (this.zip && this.zip.trim()) {
            // await this.page.waitForNavigation({waitUntil : 'load'});
            await this.page.waitFor('#nav-global-location-slot');
            await this.page.tap('#nav-global-location-slot');
            await this.page.waitFor('#GLUXMobilePostalCodeLink');
            await this.page.waitFor(1000);
            await this.page.tap('#GLUXMobilePostalCodeLink');
            await this.page.waitFor(1000);
            await this.page.type('#GLUXZipUpdateInput', this.zip, {delay: 20});
            await this.page.waitFor('#GLUXMobilePostalCodeSubmit');
            await this.page.tap('#GLUXMobilePostalCodeSubmit');
            await this.page.waitFor(1000);
            // await this.page.click('[name="glowDoneButton"]');
        }
    }

    async addProductToResult(name, asin, rank){
        this.result.push(new Good(name, asin, rank));
    }

    async sendResponse(name, asin, rank){
        try {
            // if (this.ws.readyState !== 3) {
                let good = new Good(name, asin, rank);
                // this.ws.send(JSON.stringify(new Response(true, '', good)));
                this.emit('data', JSON.stringify(new Response(true, '', good)));
            // }
        } catch (err) {
            console.log('ERROR in sendResponse: ', err);
        }
    }

    async sendLastResponse(){
        try {
            // if (this.ws.readyState !== 3) {
                let good = new Good('', '', '', true)
                // this.ws.send(JSON.stringify(new Response(true, '', good)));
                this.emit('data', JSON.stringify(new Response(true, '', good)));
                await this.close();
            // }
        } catch (err) {
            console.log('ERROR in sendResponse: ', err);
        }
    }

    async getProducts(){
        await this.page.waitForSelector('[data-asin]:nth-child(-n+14)');
        const products = await this.page.$$('[data-asin]:nth-child(-n+14)');
        return products;
    }

    async parseProducts(products){
        for (let product of products) {
            let priceEl = await product.$('.a-offscreen:not(:empty)');
            if (priceEl) {
                const price = await this.page.evaluate(element => element.textContent, priceEl);
                console.log(price);
            }
        }
    }

    async nextPage(){
        let nextPage;
        let url;
        try {
            await this.page.waitFor('ul.a-pagination');
            nextPage = await this.page.$(`li.a-last a`);
        } catch (err) {
            console.log(err);
        }
        
        if (nextPage) {
            url = await this.page.evaluate(element => element.getAttribute('href'), nextPage);
        }
        
        console.log(url ? `NEXT PAGE EXISTS: ${url}` : 'NEXT PAGE NOT EXISTS');
        if (url) {
            await this.page.goto('https://www.amazon.com' + url);
            return true;
        } else {
            return false;
        }
    }

    async openGoodPage(product){
        try {

            let urlEl;
            
            urlEl = await product.$('a[href]');

            if (!urlEl) {
                urlEl = product;
            }
            console.log(product.asElement());
            let url = await this.page.evaluate(element => element.getAttribute('href'), urlEl);
            console.log('URL: ', url);

            this.goodPage = await this.browser.newPage();

            await this.goodPage.setRequestInterception(true);
            let ignoreElements = ['image', 'stylesheet', 'font', 'script']; //'stylesheet', 'font', 'script'
            this.goodPage.on('request', (req) => {
                if(ignoreElements.indexOf(req.resourceType()) !== -1){
                    req.abort();
                }
                else {
                    req.continue();
                }
            });

            await this.goodPage.setViewport({
                width : 1920,
                height : 1080
            });
            try {
                await this.goodPage.goto('https://www.amazon.com' + url);
            } catch (e) {
                this.goodPage.close();
                return false;
            }

            return true;
        } catch (err) {
            console.log('ERROR: in openGoodPage', err);
        }
    }

    async closeGoodPage(){
        try {
            await this.goodPage.close();
        } catch (err) {
            console.log('ERROR in closeGoodPage', err);
        }
    }

    async getName(){
        try {
            await this.goodPage.waitForSelector('#productTitle');
            let tile = await this.goodPage.$('#productTitle');
            const name = await this.goodPage.evaluate(element => element.textContent, tile);
            return name.replace(/\r?\n|\r/g, '').trim();
        } catch (err) {
            console.log('ERROR in getName', err);
        }
    }

    async getRank(){
        // const html = await this.goodPage.content();
        // const formattedHTML = html.replace(/ +(?= )/g,'');
        // const rank = formattedHTML.match(/(#.+ in .+) \(See/);
        try {
            const result = await this.goodPage.evaluate(() => document.body.innerText.match(/(#.+ in .+) \(See/));
            // console.log(rank);
            return result instanceof Array ? result[1] : result;
        } catch (err) {
            console.log('ERROR in getRank', err);
        }
    }

    async getASINsFromProduct(product){
        try {
            let asin = await this.page.evaluate(obj => obj.getAttribute('data-asin'), product);
            return asin;
        } catch (err) {
            console.log('ERROR in getASINsFromProduct', err);
        }
    }

    async getGoodsInfo(){
        let goNext = true;

        while (goNext) {
            let products = await this.getProducts();
            console.log('products: ', products);
            for (let product of products) {
                if (this.closed) {
                    await this.sendLastResponse();
                    await this.close();
                    return;
                }
                console.time('getting product', product);
                let opened = await this.openGoodPage(product);

                if (opened) {
                    let name = await this.getName();
                    let rank = await this.getRank();
                    let asin = await this.getASINsFromProduct(product);
                    console.log(name, asin, rank);
                    await this.sendResponse(name, asin, rank);
                    await this.closeGoodPage();
                    console.timeEnd('getting product');
                }
            }

            console.log(this.result);
            goNext = await this.nextPage();
        }

        await this.sendLastResponse();
        return this.result;
    }

    async getOnlyAsins(){
        let goNext = true;

        // await this.page.waitForNavigation({waitUntil : 'load'});

        while (goNext) {
            let products = await this.getProducts();

            for (let product of products) {
                if (this.closed) {
                    await this.sendLastResponse();
                    return;
                }
                console.time('getting product (ONLY ASIN)');
                let asin = await this.getASINsFromProduct(product);
                await this.sendResponse('', asin, '', '');
                console.timeEnd('getting product (ONLY ASIN)');
            }

            await this.page.waitFor(5000);
            goNext = await this.nextPage();
        }
        console.log('THAT WAS LAST PAGE');
        await this.sendLastResponse();
    }
}