
const fs = require('fs')
const path = require('path')
const turndown = require('turndown') // HTML转MD库
const puppeteer = require('puppeteer')  //无头浏览器


async function getArticleInfo() {

    const turndownService = new turndown()
    // 添加扩展以处理HTML代码块
    turndownService.addRule('codeBlock', {
        filter: function (node) {
            return (
                node.nodeName === 'PRE' &&
                node.firstChild &&
                node.firstChild.nodeName === 'CODE'
            );
        },
        replacement: function (content, node) {
            return '```' + node.firstChild.getAttribute('class') + '\n' + node.textContent + '\n```';
        },
    });

    const chromiumPath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'  // 谷歌浏览器

    // 文章列表api
    const apiURL = 'https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed?aid=2608&uuid=7243396275293619752&spider=0'
    // 文章数据
    const apiData = { id_type: 2, client_type: 2608, sort_type: 200, cursor: "0", limit: 10 }



    // 启动chrome浏览器
    const browser = await puppeteer.launch({
        // 指定该浏览器的路径
        executablePath: chromiumPath,
        // 是否为无头浏览器模式，默认为无头浏览器模式
        headless: false
    });

    // 在一个默认的浏览器上下文中被创建一个新页面
    const page = await browser.newPage();
    page.setDefaultTimeout(60000)

    // 导航到目标网页
    await page.goto('https://juejin.cn');

    async function main() {
        // 模拟post请求(apiURL请求文章列表)
        const response = await page.evaluate(async (url, postDate) => {
            console.log('正在爬取文章列表中....');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(postDate)
            })
            const data = await response.json()
            return data
        }, apiURL, apiData)

        // 处理数据(过滤掉不需要的数据)
        const articleList = await responseHandle(response.data)

        // 获取文章详情
        const articles = await getArticleDetails(articleList)

        // 关闭浏览器
        browser.close()

        return articles

    }



    // 处理数据
    const responseHandle = (list) => {
        const resList = []
        list.forEach((item) => {
            // 过滤掉广告文章
            if (item.item_type == 14) return

            const defaultImg = 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/e08da34488b114bd4c665ba2fa520a31.svg'

            // 拿到需要的数据
            const id = item.item_info.article_id
            const cover = item.item_info.article_info.cover_image ? item.item_info.article_info.cover_image : defaultImg
            const title = item.item_info.article_info.title
            const type = 'public'

            resList.push({
                id, cover, title, type
            })
        })

        return resList
    }

    // 获取文章详情
    const getArticleDetails = async (articleList) => {
        const baseURL = 'https://juejin.cn/post'
        const articles = []

        for (const article of articleList) {
            await page.goto(`${baseURL}/${article.id}`, { timeout: 100000 })
            await page.waitForSelector('#article-root')
            // 使用evaluate方法在浏览器中执行JavaScript代码
            let element = await page.evaluate(() => {
                const element = document.getElementById('article-root');
                return element.innerHTML
            });

            element = element.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
            // html转换md
            const content = String(await turndownService.turndown(element))

            // 提取所有图片地址
            const reg = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g

            const imgList = content.match(reg)?.map(item => {
                // 截取图片链接
                return /https?:\/\/[^\s)]+/.exec(item)[0]
            })

            articles.push({
                id: article.id,
                cover: article.cover || imgList[0] || 'images\default.jpg',
                title: article.title,
                type: article.type,
                content,
                imgList: imgList || []
            })
        }
        return articles

    }

    const data = await main()

    fs.writeFileSync('./article.json', JSON.stringify(data))


}

getArticleInfo()




module.exports = getArticleInfo