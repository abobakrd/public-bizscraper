const _https = require('https');
const _fs = require('fs');
const _async = require('async');
const _colors = require('colors');
const _request = require('./request');
const _wpapi_save_lighthouse_html_reports = require('./wpapi_save_lighthouse_report');
const _wpapi_save_screenshot = require('./wpapi_savescreenshot');
const _get_final_url = require('./geturl');

// attributes for filtering out lists
let filterCompanyIndustries = JSON.parse(_fs.readFileSync('./filterlists/filterCompanyIndustries.json'));
let filterCompanyNames = JSON.parse(_fs.readFileSync('./filterlists/filterCompanyNames.json'));
let filterEmailProviderDomains = JSON.parse(_fs.readFileSync('./filterlists/filterEmailProviderdomains.json'));

let filteredOutBisses = 0;

let bislistPaths = _fs.readdirSync('./bislists');

function GetBislist(fileIndex, maxBisArrLength) {
   let unfilteredList = JSON.parse(_fs.readFileSync('./bislists/' + bislistPaths[fileIndex]));
   if (maxBisArrLength) unfilteredList = unfilteredList.slice(0, maxBisArrLength);
   let list = [];

   for (i = 0; i < unfilteredList.length; i++) {
      let isValidCompany = true;
      const bis = unfilteredList[i];
      for (j = 0; j < bis.proffIndustries.length; j++) {
         if (filterCompanyIndustries.includes(bis.proffIndustries[j].name)) {
            isValidCompany = false;
            break;
         }
      }

      if (isValidCompany) {
         let rxp = new RegExp(bis.displayName);
         for (j = 0; j < filterCompanyNames.length; j++) {
            if (rxp.test(filterCompanyNames[j])) {
               isValidCompany = false;
               break;
            }
         }
      }

      if (isValidCompany) {
         bis.revenue_class = bislistPaths[fileIndex].match(/-(\d{3,4}-\d{3,4})\.json$/)[1].replace(/-/g, '_');
         list.push(bis);
      } else {
         filteredOutBisses++;
      }
   }

   return list;
}

//////////////////////////////////////////////////////
//////////////// FILE CONFIG /////////////////////////
//////////////////////////////////////////////////////
let fileIndex = 0;
let bis;
let bisset = {};

// total count of processed businesses
let biscountFilename = './biscount-' + bislistPaths[fileIndex].replace(/\.json/, '') + '.txt';
let bisFinished =
   (_fs.existsSync(biscountFilename))
      ? parseInt(_fs.readFileSync(biscountFilename, 'utf8'))
      : 0;

// Businesses that misses phone/website
let invalidBislistFilename = './invalid-bislist-' + bislistPaths[fileIndex];
let invalidBislist =
   (_fs.existsSync(invalidBislistFilename))
      ? JSON.parse(_fs.readFileSync(invalidBislistFilename))
      : {};

let bisResultsCacheFileName = './completed-bisses-' + bislistPaths[fileIndex];
let bisResultsCache =
   (_fs.existsSync(bisResultsCacheFileName))
      ? JSON.parse(_fs.readFileSync(bisResultsCacheFileName))
      : {};

function IsBisCachedOrInvalid(orgnum) {
   return new Promise(resolve => {
      if (bisResultsCache[orgnum])
         return resolve('COMPLETED');
      else if (invalidBislist[orgnum])
         return resolve('INVALID');
      else
         return resolve(false);
   });
}

let bislist = GetBislist(fileIndex);

function GetWebsiteLinkAndEmail(data, orgnum) {
   if (!data.hasOwnProperty('items')) return;
   else if (data.items.length < 1) return;

   console.log('gulesider: extracting contact info for orgnum', orgnum);

   data.items.forEach(e => {
      // get website link
      try {
         bisset[orgnum].website_link = e.contact.homepage.link;
         if (bisset[orgnum].website_link)
            console.log('');
      } catch (error) {
         // no such property
      }

      // get webshop status
      try {
         bisset[orgnum].is_webshop = e.isWebshop;
      } catch (error) {
         // no such property
      }

      // get email
      try {
         let email = e.contact.email.link;
         if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email))
            bisset[orgnum].email = email;
      } catch (error) {
         // no such property
      }

      try {
         bisset[orgnum].phoneNumber = e.phoneNumbers[0].phoneNumber;
      } catch (error) {
         // no such property
      }
   });
}
function GulesiderInfoFetcher(orgnum) {
   console.log('gulesider: request for orgnum ', orgnum);

   let url = 'https://www.gulesider.no/api/cs?device=desktop&query=' + encodeURIComponent(orgnum) + '&sortOrder=default&profile=no&page=1&lat=0&lng=0&limit=25&review=0&webshop=false&client=true';
   return _request(url, true);
}

function RoundTo2Decimals(num) {
   return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Checks to see if website is mobilefriendly, fast, secure and lightweight
function RunWebsiteLighthouseTest(url, strategy) {
   //GET 

   //https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fsikringsradioen.no%2F&category=BEST_PRACTICES&category=SEO&category=PERFORMANCE&strategy=MOBILE&key=AIzaSyBHF5kAT57XEakLCqLxqokRrtiYcCjaD0M'
   const google_pagespeed_api_endpoint_url = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(url) + '&category=BEST_PRACTICES&category=PERFORMANCE&category=SEO&locale=no&strategy=' + strategy + '&key=AIzaSyBHF5kAT57XEakLCqLxqokRrtiYcCjaD0M';
   return _request(google_pagespeed_api_endpoint_url);
}

function SetLighthouseProps(lhRes, strategy, orgnum) {
   try {
      // complete lighthouse result
      // bisset[orgnum]['lighthouse_' + strategy + '_complete_result'] = r;

      let r = lhRes.lighthouseResult.audits;

      // total byte weight
      bisset[orgnum]['LH ' + strategy + ' size display value'] = r['total-byte-weight']['displayValue'];
      bisset[orgnum]['LH ' + strategy + ' size (mb)'] = RoundTo2Decimals(r['total-byte-weight']['numericValue'] / 1024 / 1024);
      bisset[orgnum]['LH ' + strategy + ' size score'] = r['total-byte-weight']['score'];

      // largest contempsual paint
      bisset[orgnum]['LH ' + strategy + ' speed (s)'] = RoundTo2Decimals(r['largest-contentful-paint']['numericValue'] / 1000);
      bisset[orgnum]['LH ' + strategy + ' speed display value'] = r['largest-contentful-paint']['displayValue'];
      bisset[orgnum]['LH ' + strategy + ' speed score'] = r['largest-contentful-paint']['score'];

      // https
      bisset[orgnum][csvHeadersEnum.lighthouse_https] = r['is-on-https']['score'];

      // viewport
      bisset[orgnum][csvHeadersEnum.lighthouse_viewport] = r['viewport']['score'];

      // statistics
      bisset[orgnum].stats['speed_seconds_' + strategy.toLowerCase()] = RoundTo2Decimals(r['largest-contentful-paint']['numericValue'] / 1000);
      bisset[orgnum].stats['size_mb_' + strategy.toLowerCase()] = RoundTo2Decimals(r['total-byte-weight']['numericValue'] / 1024 / 1024);
      bisset[orgnum].stats['best_practices_score_' + strategy.toLowerCase()] = lhRes.lighthouseResult['categories']['best-practices']['score'];
      bisset[orgnum].stats['performance_score_' + strategy.toLowerCase()] = lhRes.lighthouseResult['categories']['performance']['score'];
      bisset[orgnum].stats['seo_score_' + strategy.toLowerCase()] = lhRes.lighthouseResult['categories']['seo']['score'];
      bisset[orgnum].stats.is_mobile_friendly = r['viewport']['score'];
      bisset[orgnum].stats.is_https = r['is-on-https']['score'];
   } catch (error) {
      console.log(error);
   }
}

let googleTimes = [];
let timeSinceLastGoogleApiQuery = 0;
function GetTimeUntilNextGoogleApiQuery() {
   timeSinceLastGoogleApiQuery += 300;
   googleTimes.push(timeSinceLastGoogleApiQuery);

   if (googleTimes.length >= maxAsyncOpsAtSameTime) { // timers from previous batches are irrelevant to new batch
      googleTimes = [];
      timeSinceLastGoogleApiQuery = 0;
   }

   console.log(`next google query in ms: ', ${timeSinceLastGoogleApiQuery}`);
   let gt = googleTimes;
   let _2ndToLastQueryDiff = (gt[gt.length - 1]) - (gt[gt.length - 2]);
   if (_2ndToLastQueryDiff < 300) {
      throw new Error('wrong google timing: ', _2ndToLastQueryDiff);
   }

   return timeSinceLastGoogleApiQuery;
}



let csvHeadersEnum = {

   // hubspot default properties
   first_name: "First name",
   last_name: "Last name",
   email: "Email",
   phone_number: "Phone number",
   job_title: "Job title",
   lead_status: "Lead status",
   life_cycle_stage: "Lifecycle stage",
   type: "Type",
   person_birth_year: "Person birth year",
   name: "Name",
   company_name: "Company name",
   company_domain_name: "Company domain name",
   website_url: "Website URL",
   email_domain: "Email domain",
   annual_revenue: "Annual revenue",
   profit: "Profit",
   industry: "Industry",
   number_of_employees: "Number of employees",
   postal_code: "Postal code",
   city: "City",
   country: "Country",
   preferred_language: "Preferred language",

   // Custom properties (max 10 on free hubspot plan)
   is_webshop: "Webshop",
   http_status_code: 'Http status code',
   // lighthouse_desktop_size_score: "LH desktop size score",
   lighthouse_desktop_speed_seconds: "LH desktop speed (s)",
   // lighthouse_desktop_speed_score: "LH desktop speed score",
   // lighthouse_desktop_screenshot_link: 'Website desktop screenshot url',
   lighthouse_https: "LH https status",
   lighthouse_viewport: "LH viewport",
   lighthouse_mobile_size_mb: "LH mobile size (mb)",
   // lighthouse_mobile_size_score: "LH mobile size score",
   lighthouse_mobile_speed_seconds: "LH mobile speed (s)",
   // lighthouse_mobile_speed_score: "LH mobile speed score",
   // lighthouse_mobile_screenshot_link: 'Website mobile screenshot url',
   lhr_desktop_report_url: 'LHR desktop url'
};

// generate the CSV file for this current bislist
let csv = Object.values(csvHeadersEnum).join() + '\n';
let csvFilename = './hubsport-import-' + bislistPaths[fileIndex].replace(/\.json$/, '') + '.csv';
if (!_fs.existsSync(csvFilename)) {
   _fs.writeFileSync(csvFilename, csv);
}

let ecommerceIndustris = ['Postordre-/internetthandel', 'Postordre-/internetthandel - annet'];

function MapPropsToHubspotProps(bis) {
   // map props to hubspot props
   bis[csvHeadersEnum.annual_revenue] = bis.revenue + ' 000';
   bis[csvHeadersEnum.city] = bis.postalAddress.postPlace;
   bis[csvHeadersEnum.company_name] = bis.displayName;
   try {
      bis[csvHeadersEnum.email] = bis.email;
      bis[csvHeadersEnum.email_domain] = bis.email.match(/@(.*)/)[1];
   } catch (error) {

   }


   if (!bis.is_webshop) {
      let isWebshop = false;
      for (let i = 0; i < bis.proffIndustries.length; i++) {
         for (let j = 0; j < ecommerceIndustris.length; j++) {
            if (bis.proffIndustries[i].name === ecommerceIndustris[j]) {
               isWebshop = true;
               break;
            }
         }
         if (isWebshop)
            break;
      }
      bis[csvHeadersEnum.is_webshop] = (isWebshop) ? 'yes' : 'no';
   } else {
      bis[csvHeadersEnum.is_webshop] = 'yes';
   }

   try {
      bis[csvHeadersEnum.first_name] = bis.personRoles[0].person.name.split(' ')[0];
   } catch (error) {

   }

   try {
      bis[csvHeadersEnum.last_name] = bis.personRoles[0].person.name.split(' ').slice(1).join(' ');
   } catch (error) {

   }

   try {
      bis[csvHeadersEnum.job_title] = bis.personRoles[0].roleName;
   } catch (error) {

   }

   try {
      bis[csvHeadersEnum.industry] = '\"' + bis.proffIndustries.map(e => e.name).join(' | ') + '\"';

   } catch (error) {

   }

   try {
      bis[csvHeadersEnum.postal_code] = bis.postalAddress.postNumber;
   } catch (error) {

   }

   try {
      bis[csvHeadersEnum.person_birth_year] = bis.personRoles[0].person.yearOfBirth;
   } catch (error) {

   }


   // avoid "undefined" as value in hubspot
   if (bis.hasOwnProperty('phoneNumber')) bis[csvHeadersEnum.phone_number] = bis.phoneNumber;
   if (bis.hasOwnProperty('numberOfEmployees')) bis[csvHeadersEnum.number_of_employees] = bis.numberOfEmployees;
   if (bis.hasOwnProperty('website_link')) {
      bis[csvHeadersEnum.company_domain_name] = bis.website_link.match(/^https?:\/\/(www\.)?(.*[^\/])/)[2];
      bis[csvHeadersEnum.website_url] = bis.website_link;
   } else if (!filterEmailProviderDomains.includes(bis[csvHeadersEnum.email_domain])) {
      bis[csvHeadersEnum.company_domain_name] = bis[csvHeadersEnum.email_domain];
   }

   bis[csvHeadersEnum.profit] = bis.profit;
   bis[csvHeadersEnum.lead_status] = 'New';
   bis[csvHeadersEnum.life_cycle_stage] = 'Marketing Qualified Lead';
   bis[csvHeadersEnum.preferred_language] = 'Norwegian';
   bis[csvHeadersEnum.country] = 'Norway';
   bis[csvHeadersEnum.name] = bis.displayName;
   bis[csvHeadersEnum.type] = 'prospect';
}

function GenerateCSVRow(bis) {
   let row = '';
   Object.values(csvHeadersEnum).forEach((header, headerIndex) => {
      if (bis.hasOwnProperty(header)) {
         row += bis[header];
      }
      if (headerIndex !== (Object.values(csvHeadersEnum).length - 1)) {
         row += ',';
      }
   });

   row += '\n';

   return row;
}

let startTime = Date.now();
let stats = {
   invalidUrlSChemes: 0,
   emailsTotal: 0,
   websitesTotal: 0,
   emailAndWebsite: 0,
   phoneAndWebsite: 0,
   onlyEmail: 0,
   onlyWebsite: 0,
   noEmail: 0,
   noWebsite: 0,
   noEmailAndWebsite: 0,
   noPhoneAndWebsite: 0,
   noPhone: 0,
   onlyPhone: 0,
   phoneTotal: 0,
   screenshotDesktopSaved: 0,
   screenshotMobileSaved: 0,
   successfullLighthouseDesktopAudits: 0,
   successfullLighthouseMobileAudits: 0,
   badHttpStatusCodes: 0,
   okHttpStatusCodes: 0
}
let allResponses = [];

let maxAsyncOpsAtSameTime = 50;
_async.mapLimit(bislist, maxAsyncOpsAtSameTime, (bis, OnFinishedCallback) => {

   // local variable
   bisset[bis.organisationNumber] = bis;
   bis.lighthouseReports = {};
   bis.stats = {};

   /**
    * Chain Start
    * Check if bis is cached or not first
    */
   IsBisCachedOrInvalid(bis.organisationNumber)
      .then(r => {
         if (r === 'COMPLETED')
            throw new Error('BIS_COMPLETED');
         else if (r === 'INVALID')
            throw new Error('BIS_INVALID');
         else return GulesiderInfoFetcher(bis.organisationNumber);
      }).then(r => {
         /////////////////////////////////////////////////////////
         /// EXTRACT CONTACT INFO AND WEBSITE URL FROM GULESIDER ///
         /////////////////////////////////////////////////////////
         GetWebsiteLinkAndEmail(r, bis.organisationNumber);

         if (bis === undefined)
            throw new Error('undefined bis!!!');

         if (!bis.hasOwnProperty('email')) {
            if (!bis.hasOwnProperty('website_link')) {
               stats.noEmailAndWebsite++;
               stats.noWebsite++;
            } else {
               stats.onlyWebsite++;
            }
            stats.noEmail++;
         }

         if (!bis.hasOwnProperty('phoneNumber')) {
            invalidBislist[bis.organisationNumber] = true;
            if (!bis.hasOwnProperty('website_link')) {
               stats.noPhoneAndWebsite++;
               stats.noWebsite++;
            } else {
               stats.onlyWebsite++;
            }
            stats.noPhone++;

            throw new Error('NO_PHONE');
         }

         stats.phoneTotal++;

         if (bis.hasOwnProperty('website_link')) {
            stats.websitesTotal++;
            stats.phoneAndWebsite++;
            return _get_final_url(bis.website_link); //////////////////////////////////// CHECK IF URL WORKS
         } else {
            invalidBislist[bis.organisationNumber] = true;
            stats.noWebsite++;
            stats.onlyPhone++;
            throw new Error('NO_URL'); // break chain
         }
      }).then(r => new Promise(rs => {

         /////////////////////////////////////////////////////////
         /////////////////// LIGHTHOUSE DESKTOP TEST  ////////////
         /////////////////////////////////////////////////////////

         if (r.httpStatusCode === 200) {
            bis.website_link = r.finalUrl;
            bis[csvHeadersEnum.http_status_code] = 200;
            stats.okHttpStatusCodes++;
            setTimeout(() => {
               rs(RunWebsiteLighthouseTest(r.finalUrl, 'DESKTOP'));
            }, GetTimeUntilNextGoogleApiQuery());
         } else {
            bis[csvHeadersEnum.http_status_code] = r.httpStatusCode;
            if (r.hasOwnProperty('errCode')) bis[csvHeadersEnum.http_err_code] = r.errCode;

            allResponses.push(r);

            if (r.errCode === 'INVALID_URL_SCHEME')
               stats.invalidUrlSChemes++;
            else
               stats.badHttpStatusCodes++;

            throw new Error('INVALID_URL_SCHEME');
         }
      })).then(lighthouseResult => new Promise(rs => {

         /////////////////////////////////////////////////////////
         /// LIGHTHOUSE MOBILE TEST (IF DESKTOP AUDIT SUCCEED) ///
         /////////////////////////////////////////////////////////

         stats.successfullLighthouseDesktopAudits++;
         SetLighthouseProps(lighthouseResult, 'desktop', bis.organisationNumber);
         bis.lighthouseReports.desktop = lighthouseResult;

         setTimeout(() => {
            rs(RunWebsiteLighthouseTest(bis.website_link, 'MOBILE', bis.organisationNumber));
         }, GetTimeUntilNextGoogleApiQuery());
      })).then(lighthouseResult => {

         /////////////////////////////////////////////////////////
         /// SAVE LIGHTHOUSE REPORTS IN THE WPDB (yourdomain.com) ///
         /////////////////////////////////////////////////////////


         stats.successfullLighthouseMobileAudits++;
         SetLighthouseProps(lighthouseResult, 'mobile', bis.organisationNumber);
         bis.lighthouseReports.mobile = lighthouseResult;

         // WP CUSTOM REST API ENDPOINT
         // save lighthouse reports as html in wp
         if (Object.keys(bis.lighthouseReports).length)
            return _wpapi_save_lighthouse_html_reports(bis);
      }).then(r => {
         console.log('inserted lighthouse html report into wpdb, r: ', r);
         let baseReportUrl = 'https://www.yourdomain.com/analyse/?o=' + bis.organisationNumber.replace(/\s/g, '') + '&rc=' + bis.revenue_class + '&device=';
         if (r.desktopR)
            bis[csvHeadersEnum.lhr_desktop_report_url] = baseReportUrl + 'desktop';
         if (r.mobileR)
            bis[csvHeadersEnum.lhr_mobile_report_url] = baseReportUrl + 'mobile';

         throw new Error('SUCCESSFULL');
      }).catch(err => {

         bisFinished++;
         _fs.writeFileSync(biscountFilename, bisFinished.toString());

         if (err.message === 'BIS_COMPLETED') {
            console.log(
               '\n///////////////////////////////////////\n' +
               '///////////////////////////////////////\n' +
               '          BIS ALREADY COMPLETED\n' +
               '///////////////////////////////////////\n' +
               '///////////////////////////////////////\n'.blue
            );
         } else if (err.message === 'BIS_INVALID') {
            console.log(
               '\n///////////////////////////////////////\n' +
               '              BIS INVALID' +
               '\n///////////////////////////////////////\n'.grey
            );
         }


         // FOR DEBUGGING IN CASE A LOT OF HTTP ERRORS ORIGINATE
         _fs.writeFileSync('./allResponses.json', JSON.stringify(allResponses));

         // SET HTTP STATUS CODE RESULT ON BIS'S WEBSITE
         try {
            if (err.hasOwnProperty('httpErr')) {
               if (err.httpErr) {
                  bis[csvHeadersEnum.httpStatusCode] = err.httpStatusCode;
               }
            }
         } catch (error) {

         }

         // ONLY INCLUDE BUSINESSES THAT HAS A PHONE
         if (err.message === 'SUCCESSFULL') {

            MapPropsToHubspotProps(bis);

            // MARK BIS AS COMPLETE
            bisResultsCache[bis.organisationNumber] = true;
            _fs.writeFileSync(bisResultsCacheFileName, JSON.stringify(bisResultsCache));

            // APPEND CSV ROW TO HUBSPOT IMPORT CSV FILE
            _fs.appendFileSync(csvFilename, GenerateCSVRow(bis));
         } {
            _fs.writeFileSync(invalidBislistFilename, JSON.stringify(invalidBislist));
         }

         console.log('Async OP finished:', JSON.stringify(err), '\n' + bislist.length - bisFinished + ' companies to go');

         // FINISH CURRENT ASYNC OP
         OnFinishedCallback(null, err);
      });
}, (err, results) => { // callback invoked when all async op's are finished
   if (err)
      throw new Error(err);

   // Copy finished list to finishBislists folder
   _fs.copyFileSync('./bislists/' + bislistPaths[fileIndex], './finishedBislists/' + bislistPaths[fileIndex]);
   if (!_fs.existsSync('./bislists' + bislistPaths[fileIndex]) && _fs.existsSync('./finishedBislists/' + bislistPaths[fileIndex])) {
      _fs.unlinkSync('./bislists/' + bislistPaths[fileIndex]);
      console.log('moved file from bislists to finishedbislists');
   } else {
      console.error('current bislist file STILL EXISTS IN BISLIST FOLDER');
   }

   console.log('all async ops finished. results: ', results);
   PrintTimeTaken();
   process.exit(0);
});

function PrintTimeTaken() {
   let statsStrs = '';
   Object.keys(stats).map(e => statsStrs += '\n' + e + ': ' + stats[e]);
   let startedAt = new Date(startTime).toLocaleString();
   let dateAndTimeToday = new Date().toLocaleString();
   let secondsSince = Math.floor((new Date() - startTime) / 1000);
   let minutesSince = RoundTo2Decimals(secondsSince / 60);
   let hoursSince = RoundTo2Decimals(minutesSince / 60);
   console.log('\nProgram finished!'.green,
      '\nStart time: '.blue, startedAt,
      '\nEnd time: '.blue, dateAndTimeToday,
      '\nHours: '.blue, hoursSince,
      '\nminutes: '.blue, minutesSince,
      '\nseconds: '.blue, secondsSince,
      '\nFiltered out businesses: '.blue, filteredOutBisses,
      '\nBusinesses audited: '.blue, bislist.length,
      '\nAudit stats: '.blue, statsStrs);
}

