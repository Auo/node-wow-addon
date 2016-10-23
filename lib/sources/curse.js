'use strict'
const request = require('request')
const ROOTURL = 'http://mods.curse.com'

module.exports = {
  getAddonInfo: function getAddonInfo(info, cb) {

    request(info.link + '/download', (err, response) => {
      if(err) { return cb(err, null) }
      if(response.statusCode !== 200) { return cb(new Error('addon not found'), null)  }

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
      if(err) { return cb(err, null) }
      if(response.statusCode !== 200) { return cb(new Error('search not successfull'), null)  }
      return cb(null, this._getSearchResults(response.body))
    })
  },

  _getSearchResults: function(html) {
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
        name: nameParts[0].substring(nameParts[0].indexOf('>') + 1, nameParts[0].length).replace('</a>',''),
        creator: nameParts[1].substring(nameParts[1].indexOf('>') + 1, nameParts[1].length).replace('</a>',''),
        link: ROOTURL + link[0].replace('<a href="',''),
        downloads: this._parseDownloads(downloads),
        image: img.filter(img=> { return img.indexOf('WoW.png') == -1}).map(img=> { return img.replace('src="','') })[0],
        category: category[1].replace('title="',''),
        portal: 'curse'
      }
    })

    return results
  },
  _parseDownloads(matches) {
      return parseInt(matches[0].replace('<dt>','').replace('</dt>','').replace(/,/g,''), 10)
  },

  _getVersion: function(html) {
    //<span itemprop="title">7.0.4</span>
    const re = /<span itemprop="title">([^<]+)<\/span>/g
    const titleMatches = html.match(re)
    .map(res => {
        return res.replace('<span itemprop="title">','')
        .replace('</span>','')
    })
    return titleMatches[4]
  },
  _getDownloadLink: function(html) {
    //<p>If your download doesn't begin <a data-project="1592" data-file="933246" data-href="http://addons.curse.cursecdn.com/files/933/246/Bagnon_7.0.4.zip" class="download-link" href="#">click here</a>.</p>
    const re = /data-href="([^"]+)"/g
    const linkMatches = html.match(re)
    .map(res => {
      return res.replace('data-href="','').replace('"','')
    })

    return linkMatches[0]
  },
  getCategories: function(cb) {
    const url = ROOTURL + '/addons/wow'

    request(url, (err, response) => {
      if(err) { return cb(err, null) }
      if(response.statusCode !== 200) { return cb(new Error('addon not found'), null)  }
      const re = /<div id="addon-categories"([\s\S]*?)<div id="addons-browse"/gm

      const categoriesData = response.body.match(re)[0]
      const reCategories = /<a href="([\s\S]*?)<\/a>/g
      const categories = categoriesData.match(reCategories)

      const cats = []

      const reLink = /<a href="([^"]+)/g
      const reName = /<\/span>([^<]+)/g
      const reNameSub = />([^<]+)/g

      let lastCategoryIndex = -1;
      for(let i = 0; i < categories.length; i++) {
        const link = categories[i].match(reLink)[0].replace('<a href="','')
        const categoryNameMatch = categories[i].match(reName)

        let name = null;
        
        if(categoryNameMatch != null) {
          name = categoryNameMatch[0].replace('</span>','').replace('\r\n','').trim().replace('&amp;','&')
        }

        if(name == null) { continue; }
        if(categories[i].indexOf('sub-cat-amount') != -1) {
          //SUBITEM
          


          cats[lastCategoryIndex].subCategories.push({
            link: link,
            name: name
          })
        } else {
          //normal item
          lastCategoryIndex++;

          cats.push({
            name: name,
            link: link,
            subCategories: []
          })

          if(cats[cats.length -1].name == 'Druid') {
            console.log(categories[i])
          }
        }
      }

      return cb(null, cats)
    })
  }
}
