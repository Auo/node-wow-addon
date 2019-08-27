'use strict'
const request = require('request')
const entities = require('entities')
const ROOTURL = 'https://wowinterface.com'
const cheerio = require('cheerio')

module.exports = {
  getAddonInfo: function getAddonInfo(info, cb) {
    request(info.link, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }
      const $ = cheerio.load(response.body)
      const version = $('#version').text().match(/Version: (.*)/)[1]

      this._getDownloadLink(info.link, (err, downloadLink) => {
        return cb(null, {
          name: entities.decodeHTML(info.name),
          version,
          link: info.link,
          downloadLink,
          portal: 'wowinterface'
        })
      })
    })
  },
  search: function search(name, cb) {
    request.post({ url: ROOTURL + '/downloads/search.php', form: { x: 0, y: 0, search: name } }, (err, response) => {
      if (err) { return cb(err, null) }

      if (response.statusCode !== 200 && response.statusCode !== 302) { return cb(new Error('addon not found'), null) }

      if (response.statusCode === 200) {
        return cb(null, this._getSearchResults(response.body))
      } else {
        //if wowinteface get direct match it will redirect to details page
        const link = ROOTURL + '/downloads/' + response.headers.location
        const creatorRe = /userid=[\d]+"><b>([^<]+)/g
        const categoryIdRe = /<a href="index\.php\?cid=([^"]+)/g
        const downloadsRe = /Downloads:<\/td><td class="[^"]+">([^<]+)/g

        const categoryTitleRe = /<title>([^<]+)/g
        request(link, (err, res) => {
          const creatorMatch = res.body.match(creatorRe)[0]
          const creator = creatorMatch.substring(creatorMatch.indexOf('<b>') + 3, creatorMatch.length)
          const titleMatch = res.body.match(categoryTitleRe)[0].replace('<title>', '')

          const title = titleMatch.split(':')[0].trim()
          const category = titleMatch.split(':')[1].trim()
          const categoryId = res.body.match(categoryIdRe)[1].replace('<a href="index.php?cid=', '')
          const downloadsMatch = res.body.match(downloadsRe)[0]
          const downloads = parseInt(downloadsMatch.substring(downloadsMatch.indexOf('">') + 2, downloadsMatch.length).replace(/,/g, '', ''), 10)
          const image = 'http://cdn-wow.mmoui.com/images/icons/m' + categoryId + '.jpg'

          return cb(null, [{
            name: entities.decodeHTML(title),
            creator: entities.decodeHTML(creator),
            link: ROOTURL + '/downloads/fileinfo.php?id=' + link.substring(link.indexOf('info') + 4, link.indexOf('-')),
            downloads: downloads,
            image: image,
            category: category,
            portal: 'wowinterface'
          }])
        })
      }
    })
  }
  ,

  _getSearchResults: function (html) {
    const re = /<tr>[\s\S]*?<\/tr>/g
    const nameRe = />([^<]+)<\/a>/g
    const linkRe = /fileinfo\.php\?s=[^&]+&amp;(id=[0-9]+)"/g
    const downRe = /<td align="center" class="[a-z0-9]+">([\d,.]+)<\/td>/g
    const imgRe = /\/\/([^"]+)/g
    const catRe = /lastupdate">([^<]+)/g

    const searchResults = html.match(re).filter(res => { return res.indexOf('searchcaticon') !== -1 })

    const results = searchResults == null || searchResults.length == 0 ? [] : searchResults.map(res => {
      const nameParts = res.match(nameRe)
      const link = res.match(linkRe)
      const downloads = res.match(downRe)
      const img = res.match(imgRe)
      const cat = res.match(catRe)

      return {
        name: entities.decodeHTML(nameParts[0].replace('</a>', '').replace('>', '')),
        creator: entities.decodeHTML(nameParts[1].replace('</a>', '').replace('>', '')),
        link: ROOTURL + '/downloads/' + link[0].substring(0, link[0].indexOf('s=')) + link[0].substring(link[0].indexOf('id='), link[0].length - 1),
        downloads: this._parseDownloads(downloads),
        image: 'http:' + img[0].replace(')', ''),
        category: cat[0].replace('lastupdate">', ''),
        portal: 'wowinterface'
      }
    })
    return results
  },
  _parseDownloads(matches) {
    return parseInt(matches[0].substring(matches[0].indexOf('>') + 1, matches[0].indexOf('</td>')).replace(/,/g, ''), 10)
  },
  _getDownloadLink: function (link, cb) {
    const url = ROOTURL + '/downloads/landing.php?fileid=' + link.substring(link.indexOf('id=') + 3, link.length)

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('could not find addon download link'), null) }
      const $ = cheerio.load(response.body)
      const downloadLink = $('.manuallink > a').attr('href')
      return cb(null, downloadLink)
    })
  },
  getCategories: function (cb) {
    const url = ROOTURL + '/addons.php'

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }
      const $ = cheerio.load(response.body)

      const categories = [];
      $('.subcats > div').each((i, element) => {
        const categoryLink = $('.subtitle > a', element).first()
        const name = categoryLink.text()
        const link = categoryLink.attr('href')

        const categoryId = link.match(/cat([0-9]+)/)[1];

        const category = {
          link: link,
          name: name,
          subCategories: [],
          portal: 'wowinterface'
        }

        $(`#subcat_${categoryId}_menu table tr td a`).each((j, childElement) => {
          const child = $(childElement);
          category.subCategories.push({
            link: child.attr('href'),
            name: child.text(),
            portal: 'wowinterface'
          })
        })

        categories.push(category)
      })

      return cb(null, categories)
    })
  },
  getAddonsFromCategory: function (cat, cb) {
    const url = cat.link
    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }

      const $ = cheerio.load(response.body)
      const addons = []

      $('.file').each((i, element) => {
        const link = $('h2 a', element)
        const author = $('.author', element).text().substring(4)
        const downloads = $('.downloads', element).text();
        const downloadCount = parseInt(downloads.replace(/,/g,''))

        const categoryNumber = cat.link.match(/cat([0-9]+)/)[1]
        const image = 'http://cdn-wow.mmoui.com/images/icons/m' + categoryNumber + '.jpg'
        
        const result = {
          name: entities.decodeHTML(link.text()),
          link: `${ROOTURL}/downloads/${link.attr('href')}`,
          creator: entities.decodeHTML(author),
          image: image,
          downloads: downloadCount,
          category: cat.name,
          portal: 'wowinterface'
        }

        addons.push(result)
      })

      return cb(null, addons)
    })
  }
}
