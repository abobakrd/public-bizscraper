# bizscraper
Public version of the scraper.

This software is intended for educational purposes only. 

A scraper that asynchronously performs various technical checks on websites provided from gulesider.no and proff.no and output its final results to WordPress Database through the WP REST API and a CSV list.
#
### What you need:
- JSON company info lists files placed in the *bislists* folder. Get the lists from proff.no/laglister... URL. This page generates JSON company info lists when using the pagination feature. While you can automate this too instead of doing it manually, I skipped it for now. All you need to automate this is a loop that runs while there always is a next pagination ID provided in the JSON response from the URL mentioned above.


#### Filename format for bislists:
```
[a-zA-Z+]-[\d{1,4}-{\d{1,4}].json
```
Where as **[a-zA-Z+]** part is the *prefix* name of the file and **[\d{1,4}]** parts are a number range that stands for company revenue from last year in a thousand number format (this means that one million is only 1000 in a thousand number format).
```
Example: smallerCompanies-1000-1400.json
```
This denotes a list of smaller companies by revenue that earned between *1000 000 NOK* to *1400 000NOK* (NOK = Norwegian currency).
#
### Filter feature
The scraper supports input for filtering out unwanted companies according to their industries, email domains and names. Simply fill up the arrays in the filterlists folder and the scraper does the rest. 

***The company industries must be in the correct format according to proff.no format system. See *title* property on the objects provided in this file: https://proff.no/proffIndustryTree.json***