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
    request.post({ url: `${ROOTURL}/downloads/search.php`, form: { x: 0, y: 0, search: name } }, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200 && response.statusCode !== 302) { return cb(new Error('search failed'), null) }
      if (response.statusCode === 200) {
        return cb(null, this._getSearchResults(response.body))
      } else {
        //if wowinteface get direct match it will redirect to details page
        const link = `${ROOTURL}/downloads/${response.headers.location}`

        request(link, (err, res) => {
          const $ = cheerio.load(res.body)
          const author = $('#author a').first().text()
          const name = $('.divline:nth-child(2) > h1').text()
          const downloadText = $('#screen-info tbody tr:nth-child(3) td:nth-child(2)').text();
          const downloads = parseInt(downloadText.replace(/,/g, ''), 10)

          const categoryLink = $('span.navbar:nth-child(4) > a')
          const category = categoryLink.text()

          const categoryId = categoryLink.attr('href').replace('index.php?cid=', '')
          const image = `http://cdn-wow.mmoui.com/images/icons/m${categoryId}.jpg`

          return cb(null, [{
            name: entities.decodeHTML(name),
            creator: entities.decodeHTML(author),
            link: `${ROOTURL}/downloads/fileinfo.php?id=${link.substring(link.indexOf('info') + 4, link.indexOf('-'))}`,
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
    const $ = cheerio.load(html)

    const results = []
    $('table.tborder:nth-child(2) > tbody tr').each((i, element) => {
      const link = $('td a', element)
      const name = link.text()
      const downloadLink = `${ROOTURL}/downloads/${link.attr('href')}`
      const author = $('td:nth-child(3)', element).text()
      const category = $('td:nth-child(3)', element).text()
      const downloads = parseInt($('td:nth-child(5)', element).text().replace(/,/g, ''), 10)

      const imageStyle = $('.searchcaticon', element).attr('style')
      const imgLink = `http:${imageStyle.replace(/(background-image:url\(|\))/g, '')}`

      results.push({
        name: name,
        creator: author,
        link: downloadLink,
        downloads: downloads,
        image: imgLink,
        category: category,
        portal: 'wowinterface'
      })
    })

    return results
  },
  _getDownloadLink: function (link, cb) {
    const url = `${ROOTURL}/downloads/landing.php?fileid=${link.substring(link.indexOf('id=') + 3, link.length)}`

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('could not find addon download link'), null) }
      const $ = cheerio.load(response.body)
      let downloadLink = $('.manuallink > a').attr('href')

      const queryIndex = downloadLink.indexOf('?')
      if (queryIndex > -1) {
        downloadLink = downloadLink.substring(0, queryIndex)
      }

      return cb(null, downloadLink)
    })
  },
  getCategories: function (cb) {
    const url = ROOTURL + '/addons.php'

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('could not get categories'), null) }
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
        const downloadCount = parseInt(downloads.replace(/,/g, ''))

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
