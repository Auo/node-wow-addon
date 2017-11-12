'use strict'
const entities = require('entities')
const request = require('request')
const ROOTURL = 'https://www.curseforge.com'

module.exports = {
  getAddonInfo: function getAddonInfo(info, cb) {
    console.log('addon info', info)
    request(info.link + '/download', (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }
      //console.log(response.body);
      const version = this._getVersion(response.body)
      const downloadLink = this._getDownloadLink(response.body)

      return cb(null, {
        name: info.name,
        version,
        link: info.link,
        downloadLink,
        portal: 'curse'
      })
    })
  },
  search: function search(name, cb) {
    //https://mods.curse.com/search?game-slug=wow&search=deadly-boss-mods
    const url = ROOTURL + '/search?game-slug=wow&search=' + name
    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('search not successfull'), null) }
      return cb(null, this._getSearchResults(response.body))
    })
  },

  _getSearchResults: function (html) {
    const re = /<tr class="wow">[\s\S]*?<\/tr>/g
    const nameRe = /<a href="[^>]+">(.*)<\/a>/g
    const linkRe = /<a href="([^"]+)/g
    const downRe = /<dt>([\d,.]+)<\/dt>/g
    const imgRe = /src="([^"]+)/g
    const catRe = /title="([^"]+)/g

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
        name: entities.decodeHTML(nameParts[0].substring(nameParts[0].indexOf('>') + 1, nameParts[0].length).replace('</a>', '')),
        creator: entities.decodeHTML(nameParts[1].substring(nameParts[1].indexOf('>') + 1, nameParts[1].length).replace('</a>', '')),
        link: ROOTURL + link[0].replace('<a href="', ''),
        downloads: this._parseDownloads(downloads),
        image: img.filter(img => { return img.indexOf('WoW.png') == -1 }).map(img => { return img.replace('src="', '') })[0],
        category: category[1].replace('title="', '').replace('&amp;', '&'),
        portal: 'curse'
      }
    })

    return results
  },
  _parseDownloads(matches) {
    return parseInt(matches[0].replace('<dt>', '').replace('</dt>', '').replace(/,/g, ''), 10)
  },

  _getVersion: function (html) {
    //<span itemprop="title">7.0.4</span>
    const re = /<span itemprop="title">([^<]+)<\/span>/g
    const titleMatches = html.match(re)
      .map(res => {
        return res.replace('<span itemprop="title">', '')
          .replace('</span>', '')
      })
    return titleMatches[4]
  },
  _getDownloadLink: function (html) {
    //<p>If your download doesn't begin <a data-project="1592" data-file="933246" data-href="http://addons.curse.cursecdn.com/files/933/246/Bagnon_7.0.4.zip" class="download-link" href="#">click here</a>.</p>
    //const re = /data-href="([^"]+)"/g
    const re = /href="\/wow\/addons\/[^"]+/g
    const linkMatches = html.match(re)
      .map(res => res.replace('href="', ''))
    console.log(ROOTURL + linkMatches[1]);
    return ROOTURL + linkMatches[1]
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
          // console.log('adding subcategory %s into %s', name, cats[lastCategoryIndex].name);
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
      //console.log(cats);
      return cb(null, cats)
    })
  },
  getAddonsFromCategory: function (cat, cb) {
    const url = cat.link
    //console.log('url is %s', url)

    request(url, (err, response) => {
      if (err) { return cb(err, null) }
      if (response.statusCode !== 200) { return cb(new Error('addon not found'), null) }

      //const reAddons = /<ul class="group">([\s\S].*?)[\s\S]*?<\/ul>/g
      const reAddons = /<li class="project-list-item">([\s\S].*?)[\s\S]*?<\/li>/g
      const addons = response.body.match(reAddons)

      //console.log('number of addons %s', addons.length)
      const parsedAddons = []

      //const reTitle = /h4>(.*?)<\/a>/g
      const reTitle = /<h2 class="list-item__title strong mg-b-05">[^<]+/g
      const reLink = /href="[^"]+/g
      //const reDownload = /download-total">[^a-zA-z ]+/g
      const reDownload = /download">[^< ]+/g

      if (!addons) {
        return cb(null, parsedAddons)
      }

      for (let i = 0; i < addons.length; i++) {
        const link = ROOTURL + addons[i].match(reLink)[0].replace('href="', '')
        //console.log('link %s', link)
        const title = addons[i].match(reTitle)[0].replace('<h2 class="list-item__title strong mg-b-05">','').trim()
        //const titleString = addons[i].match(reTitle)[0].replace('h4>', '').replace('</a>', '')
        //const title = titleString.substring(titleString.indexOf('>') + 1, titleString.length)
        //console.log('the title is %s', title)
        //const downloads = parseInt(addons[i].match(reDownload)[0].replace('download-total">', '').replace(/,/, ''))
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
