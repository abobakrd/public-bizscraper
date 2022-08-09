const _https = require('https');
const _fs = require('fs');
const ReportGenerator = require('./node_modules/lighthouse/lighthouse-core/report/report-generator.js');

function GetHtmlB64Report(lhReport) {
   lhReport.userAgent = 'HeadlessChrome';
   lhReport.environment.networkUserAgent = 'Chrome-Lighthouse';
   lhReport.environment.hostUserAgent = 'HeadlessChrome';
   let html = ReportGenerator.generateReportHtml(lhReport);
   let styleInHead = html.match(/<style>(.|\n|\r.)*?<\/style.*>/i)[0];
   html = html.replace(/<\!doctype html>(.|\n|\r)*?<\/head.*>/, '<div id="wn_lhr_html">' + styleInHead);
   html = html.replace(/<body(.*\n*|\n*.*)(?<altid>(class|id)="(.*)")>/, '<div $<altid>>');
   html = html.replace(/<\/body.*>/, '</div>');
   html = html.replace(/<\/html.*>/, '</div>');
   // _fs.writeFileSync('./_test.html', html);
   return Buffer.from(html).toString('base64');
}

function encode_nordic_characters(str) {
   let nordicChars = { å: '___a___', ø: '___o___', æ: '___e___' };
   for (const key in nordicChars) {
      str = str.replace(new RegExp(key, 'gi'), nordicChars[key]);
   }
   return str;
}

module.exports = function save_lighthouse_html_reports(bis) {
   return new Promise((resolve, reject) => {

      let data = {
         wn_pw: '_.^#,R03-_,,**kSlzd=!)%!0134OZsdaOELTdD',
         wn_orgnum: bis.organisationNumber.replace(/\s/g, ''),
         wn_revclass: bis.revenue_class,
         wn_company_url: encode_nordic_characters(bis.website_link),
         wn_company_name: encode_nordic_characters(bis.displayName),
         wn_lhr_stats: bis.stats
      };

      let hasMobileReport = false;
      let hasDesktopReport = false;

      Object.keys(bis.lighthouseReports).forEach(key => {
         if (key.toLowerCase() === 'mobile') hasMobileReport = true;
         if (key.toLowerCase() === 'desktop') hasDesktopReport = true;
         data['wn_lhr_' + key + '_b64'] = GetHtmlB64Report(bis.lighthouseReports[key].lighthouseResult);
      });

      data = JSON.stringify(data);

      // _fs.writeFileSync('./before_send.html', ReportGenerator.generateReportHtml(bis.lighthouseReports.desktop.lighthouseResult));
      // _fs.writeFileSync('./beforesend.txt', lhrB64);

      const options = {
         hostname: 'www.yourdomain.com',
         port: 443,
         path: '/wp-json/lighthouse/lhr',
         method: 'POST',
         headers: {
            'Content-type': 'application/json',
            'Content-Length': data.length
         }
      };
      const req = _https.request(options, res => {
         console.log('WP-API: StatusCode: ', res.statusCode);

         let buffers = [];
         res.on('data', buff => buffers.push(buff));
         res.on('end', () => {
            let endRes = Buffer.concat(buffers).toString();
            try {
               if (JSON.parse(endRes).code === 'rest_invalid_json')
                  _fs.writeFileSync('./failed_data.json', data + '\n\n', { flag: 'a' });
            } catch (error) {

            }
            return resolve({ res: endRes, desktopR: hasDesktopReport, mobileR: hasMobileReport });
         });
      });
      req.on('error', err => reject(err));
      req.write(data);
      req.end();
   });
}

// test
// save_lighthouse_html_reports(JSON.parse(_fs.readFileSync('./bis_test.json', 'utf-8')))
//    .then(r => console.log('AIGHT!: ', r)).catch(err => console.log('er0r: ', err));