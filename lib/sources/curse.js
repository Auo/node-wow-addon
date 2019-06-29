'use strict'
const entities = require('entities')
const request = require('request')
const ROOTURL = 'https://www.curseforge.com'
const cheerio = require('cheerio')

module.exports = {
  _parseDownloads(downloads) {
    downloads = downloads.replace('Downloads', '')
      .replace(',', '.')
      .replace(/ /g, '')
      .trim()

    if (downloads.indexOf('M') != -1) {
      return parseFloat(downloads.substring(0, downloads.length - 1)) * 1000000
    } else if (downloads.indexOf('K') != -1) {
      return parseFloat(downloads.substring(0, downloads.length - 1)) * 1000
    } else {
      return parseFloat(downloads);
    }
  },
  getAddonInfo: function getAddonInfo(info, cb) {
    request(info.link + '/download', (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }

      const $ = cheerio.load(response.body)
      const downloadLink = ROOTURL + $('div.box p.text-sm a').attr('href')

      this._getVersion(info.link, (err, version) => {
        return cb(null, {
          name: info.name,
          version,
          link: info.link,
          downloadLink,
          portal: 'curse'
        })
      })
    })
  },
  _getVersion: function (link, cb) {
    request(link + '/files', (err, response) => {
      if (err) { return cb(err, null) }
      const $ = cheerio.load(response.body)
      const version = $('article h3').text()
      return cb(null, version);
    })
  },
  search: function search(name, cb) {
    const url = ROOTURL + '/wow/addons/search?search=' + name.replace(' ', '+')
    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('search not successfull'), null) }
      return cb(null, this._getSearchResults(response.body))
    })
  },

  _getSearchResults: function (html) {
    const $ = cheerio.load(html)
    const result = []
    $('div.my-2').each((i, element) => {
      const name = $('h3', element).first().text();
      const nameLinks = $('a.my-auto', element);
      const link = ROOTURL + nameLinks.first().attr('href')
      const creator = nameLinks.next().next().text()
      const downloads = this._parseDownloads($('span.mr-2', element).first().text())

      const image = $('img.mx-auto', element).attr('src');
      const categories = []

      $('figure', element).each((ix, catElement) => categories.push($(catElement).attr('title')))

      result.push({
        name: entities.decodeHTML(name),
        creator,
        link,
        downloads,
        image,
        category: categories.join(', '),
        portal: 'curse'
      })
    })

    return result;
  },


  getCategories: function (cb) {
    const url = ROOTURL + '/wow/addons';

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('Could not find categories'), null) }

      const $ = cheerio.load(response.body)
      const elements = $('nav.my-2 > div.category-list-item')

      const categories = []

      elements.each((i, element) => {
        let hasChildren = $(element).attr('data-has-child') === 'true'
        let link = $('a', element).attr('href')

        let subCategories = [];

        const name = $('span.whitespace-no-wrap', element).first().text().replace(/\n/g, '').trim()

        if (hasChildren) {
          const children = $('div.category-list-item > div.px-2', element)

          children.each((i, child) => {
            let childLink = $('a', child).attr('href')
            let childName = $('span.whitespace-no-wrap', child).text().replace(/\n/g, '').trim()
            subCategories.push({ name: childName, link: ROOTURL + childLink, portal: 'curse' })
          })
        }

        categories.push({
          name,
          link: ROOTURL + link,
          subCategories,
          portal: 'curse'
        })
      })

      return cb(null, categories)
    })
  },
  getAddonsFromCategory: function (cat, cb) {
    request(cat.link, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('No addons found in category. statusCode: ' + response.statusCode), null) }

      const $ = cheerio.load(response.body)
      const elements = $('div.px-2 .my-2')

      const addons = []

      elements.each((i, element) => {
        const name = $('h3', element).text()
        const link = $('.my-auto', element).attr('href')
        const downloads = this._parseDownloads($('span.mr-2', element).first().text())

        addons.push({
          name: entities.decodeHTML(name),
          link: ROOTURL + link,
          creator: '', //not parsable on page
          image: '', //the category icon is not available  here from curse. Could probably build it without parsing.
          downloads: downloads,
          category: cat.name,
          portal: 'curse'
        })
      })

      return cb(null, addons)
    })
  }
}
