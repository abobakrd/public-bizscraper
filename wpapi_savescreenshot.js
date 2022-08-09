const _wp_api = require('wpapi');
const _fs = require('fs');
const { randomUUID } = require('crypto'); // Added in: node v14.17.0

/**
 * WPAPI
 * Saves screenshots obtained from lighthouse results to wordpress site through WP Rest API
 */

// WPAPI Setup
let wpapi = new _wp_api({
   endpoint: 'https://www.yourdomain.com/wp-json',
   username: 'yourUsername',
   password: 'yourPassword',
   auth: true
});

function SaveImageLocally(filename, b64data) {
   return new Promise((resolve, reject) => {
      try {
         _fs.writeFile(filename, b64data, 'base64', err => {
            if (err)
               return reject(err);
            resolve();
         });
      } catch (error) {
         console.error('could not save image locally: ', error);
         throw new Error(error);
      }

   });
}

let screenshotIndex = 0;

module.exports = function SaveScreenshot(lhData, bis, strategy) {
   return new Promise((resolve, reject) => {
      screenshotIndex++;
      let rxpB64Protocol = new RegExp(/^data:image\/((png)|(jpeg));base64,/);
      let b64RawData = lhData.lighthouseResult.audits['final-screenshot']['details']['data'];
      let imgType = b64RawData.match(rxpB64Protocol)[1];
      let b64data = b64RawData.replace(rxpB64Protocol, '');
      let localImagePath = './screenshots/' + strategy.toLowerCase()[0] + '-' + randomUUID() + '.' + imgType;

      SaveImageLocally(localImagePath, b64data)
         .then(() => {
            return wpapi.media()
               // Specify a path to the file you want to upload, or a Buffer
               .file(localImagePath)
               .create({
                  title: bis.displayName
               });
         })
         // save screenshot to WP site 
         .then(function (response) { // successfull image upload
            console.log('wpapi: saved screenshot for website: ' + bis.website_link);
            _fs.unlinkSync(localImagePath);
            resolve({ status: 'ok', url: response.source_url });
         }).catch(err => {
            console.error('error while saving image locally/remotely or unlinking locally: ', err);

            resolve({ status: 'error', error: err });
         });
   });
}