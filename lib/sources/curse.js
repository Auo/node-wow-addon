'use strict'
const entities = require('entities')
const request = require('request')
const ROOTURL = 'https://www.curseforge.com'

module.exports = {
  getAddonInfo: function getAddonInfo(info, cb) {
    request(info.link + '/download', (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }
      const downloadLink = this._getDownloadLink(response.body)

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
  search: function search(name, cb) {
    const url = ROOTURL + '/wow/addons/search?search=' + name.replace(' ', '+')
    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('search not successfull'), null) }
      return cb(null, this._getSearchResults(response.body))
    })
  },

  _getSearchResults: function (html) {
    const re = /<li class="project-list-item">([\s\S].*?)[\s\S]*?<\/li>/g
    const nameRe = /<h2 class="list-item__title strong mg-b-05">[^<]+/g
    const linkRe = /href="[^"]+/g
    const downRe = /download">[^< ]+/g
    const imgRe = /src="[^"]+/g
    const catRe = /title="[^"]+" class="category__item/g

    const searchResults = html.match(re)

    const results = searchResults == null || searchResults.length == 0 ? [] : searchResults.filter(res => {
      return res.indexOf('/addon-packs/') == -1
    }).map(res => {
      const nameParts = res.match(nameRe)
      const link = res.match(linkRe)
      const downloads = res.match(downRe)
      const img = res.match(imgRe)
      const category = res.match(catRe)

      return {
        name: entities.decodeHTML(nameParts[0].replace('<h2 class="list-item__title strong mg-b-05">','').trim()),
        creator: '',
        link: ROOTURL + link[0].replace('href="', ''),
        downloads: this._parseDownloads(downloads),
        image: img[0].replace('src="', ''),
        category: entities.decodeHTML(category.map(c => c.replace('title="', '').replace('" class="category__item', '')).join(',')),
        portal: 'curse'
      }
    })

    return results
  },
  _parseDownloads(matches) {
    return parseInt(matches[0].replace('download">', '').replace(/,/g, ''), 10)
  },

  _getVersion: function (link, cb) {
    request(link + '/files', (err, response) => {
      if (err) {
        return cb(err, null)
      }
      const version = response.body.match(/"project-file__name" title="[^"]+/g)[0]
      .replace('"project-file__name" title="','')
      return cb(null, version);
    })    
  },
  _getDownloadLink: function (html) {
    const link = html.match(/href="\/wow\/addons\/[^"]+/g)[1].replace('href="', '')
    return ROOTURL + link
  },
  getCategories: function (cb) {
    const url = ROOTURL + '/wow/addons';

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }

      const re = /"category__item pd-x-1([\s\S]*?)<\/li>/gm
      const categories = response.body.match(re)
      const cats = []

      const reLink = /<a href="([^"]+)/g
      const reName = /data-category="[^"]+/g

      const reNameSub = />([^<]+)/g
      let subcategoriesLeft = 0;
      let lastCategoryIndex = -1;
      for (let i = 0; i < categories.length; i++) {
        const link = ROOTURL + categories[i].match(reLink)[0].replace('<a href="', '')
        if (link === ROOTURL + '/wow/addons') { continue; }

        const categoryNameMatch = categories[i].match(reName)
        let name = null

        if (categoryNameMatch != null) {
          name = categoryNameMatch[0].replace('data-category="', '')
        }

        if (name === null) { continue; }
        if (name === 'Addons') { continue; }
        const hasSubcategories = categories[i].match(/data-root="[^"]+/g)[0].replace('data-root="', '') === 'True'

        if (hasSubcategories) {
          const subCategoryRe = new RegExp(`data-category="${name}" class="tier-holder hidden">([\\s\\S].*?)[\\s\\S]*?<\/ul>`, 'g')
          subcategoriesLeft = response.body.match(subCategoryRe)[0].match(/<li/g).length

          lastCategoryIndex++

          cats.push({
            name: name,
            link: link,
            subCategories: [],
            portal: 'curse'
          })
        } else if (subcategoriesLeft > 0) {
          subcategoriesLeft--
          cats[lastCategoryIndex].subCategories.push({
            link: link,
            name: name,
            portal: 'curse'
          })
        } else {
          lastCategoryIndex++

          cats.push({
            name: name,
            link: link,
            subCategories: [],
            portal: 'curse'
          })
        }
      }
      return cb(null, cats)
    })
  },
  getAddonsFromCategory: function (cat, cb) {
    const url = cat.link

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }

      const reAddons = /<li class="project-list-item">([\s\S].*?)[\s\S]*?<\/li>/g
      const addons = response.body.match(reAddons)
      
      const parsedAddons = []

      const reTitle = /<h2 class="list-item__title strong mg-b-05">[^<]+/g
      const reLink = /href="[^"]+/g
      const reDownload = /download">[^< ]+/g

      if (!addons) {
        return cb(null, parsedAddons)
      }

      for (let i = 0; i < addons.length; i++) {
        const link = ROOTURL + addons[i].match(reLink)[0].replace('href="', '')
        const title = addons[i].match(reTitle)[0].replace('<h2 class="list-item__title strong mg-b-05">', '').trim()
        const downloads = parseInt(addons[i].match(reDownload)[0].replace('download">', '').replace(/,/, ''))

        parsedAddons.push({
          name: entities.decodeHTML(title),
          link: link,
          creator: '', //not parsable on page
          image: '', //the category icon is not available  here from curse. Could probably build it without parsing.
          downloads: downloads,
          category: cat.name,
          portal: 'curse'
        })
      }

      return cb(null, parsedAddons)
    })
  }
}
