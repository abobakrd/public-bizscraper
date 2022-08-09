# bizscraper
Public version of the scraper.

This software is intended for educational purposes only. 

A NodeJS scraper that asynchronously scrapes and performs website audits on fetched domains provided from gulesider.no and proff.no before outputting its final results to WordPress Database through the WP REST API and a CSV list.
#
### What you need:
- JSON company info lists files placed in the *bislists* folder. Get the lists from https://proff.no/laglister URL. This page generates JSON company info lists when using the pagination feature. While you can automate this too instead of doing it manually, I skipped it for now. All you need to automate this is a loop that runs while there always is a next pagination ID provided in the JSON response from the URL mentioned above.


#### Filename format for bislists:
```
[a-zA-Z+]-[\d{1,4}-{\d{1,4}].json
```
Where as **[a-zA-Z+]** part is the *prefix* name of the file and **[\d{1,4}]** parts are a number range that stands for company revenue from last year in a thousand number format (this means that one million is only 1000).
```
Example: smallerCompanies-1000-1400.json
```
This denotes a list of smaller companies by revenue that earned between *1 000 000 NOK* to *1 400 000 NOK* (NOK = Norwegian currency).
- WordPress user for WP REST API. Simply generate a new user in your wordpress site and add its credentials to files prefixed with *wpapi_* in the scraper. In order to save the lighthouse reports you must create a endpoint in your wordpress WP REST API that threats the request and parses the JSON before inserting it in the database. The endpoint being used in the scraper is *wordpressSite.com/wp-json/lighthouse/lhr*, but you can change this to your preferred choice. The screenshot is automatically handled by the [wpapi](https://www.npmjs.com/package/wpapi?activeTab=versions) npm as it creates a new image row in the media database table.
#
### Filter feature
The scraper supports input for filtering out unwanted companies according to their industries, email domains and names. Simply fill up the arrays in the filterlists folder and the scraper does the rest. 

***The company industries must be in the correct format according to proff.no format system. See *title* property on the objects provided in this file: https://proff.no/proffIndustryTree.json***

Clone and type *node scraper* in the root directory. You could also use PM2 to create more instances that run in paralell.