# Elastic Load Balancing Access Logs Analyzer
A NodeJS app to generate reports based on AWS Elastic Load Balancing Access Logs. 

The app will access the configured S3 bucket containing the elb logs, read them and generate a CSV report containing the Domain Name and Domain Count based of the number of the domain occurences within the log.

This app is built using the LocomotiveJS MVC web framework as it contains Express as well as future support for the app's Web Interface.

## Node Dependencies (see package.json)
1. async - asynchronous support execution
2. nconf - for different environment configurations
3. moment - Date/Time features
4. log4js - Used for the app's logging.
5. knox - Used as the library to communicate with AWS
6. node-csv - Library for CSV generation (using streaming)
7. level - library for storing key-value pairs

## Configuration
These must be configured before running the app.
App configuration can be set in ``config\config.json``

1. Environments
    * When running the app, ``NODE_ENV`` can be set to determine what environment configuration will be used. If this is not supplied, the app will use ``default`` instead.

2. AWS S3 config
    
    ```javascript
    "aws"  : {
        "region" : "my-region",
        "access_key_id" : "my-access-key-id",
        "secret_access_key" : "mysecretaccesskey",
        "bucket"    :   "aws-elb-log-bucket-name",
        "folder"    :   "path/to/elb/logs"
    }

3. Log filters
    * AWS ELB Access Log folders may contain huge amount of log files. For testing and limiting purposes, limit the number of processed log by supplying ``max_keys``. Setting ``max_keys : ""`` will process **all** logs within the folder.
    * Note that by default, to avoid performance issues, the app will only process current day logs. To process logs on a previous date, supply a date folder string in ``date_folder`` with a format of ``{yyyy}\{mm}\{dd}``.
4. App logs
    * Every app execution is saved into the ``logs`` folder. You can set a custom log name via ``app_log : { "name" : "my_log_name"}``. This will save the logs in ``logs/my_log_name_{timestamp}.log`` format. Logs will be created per app execution.
5. Report options
    * The generated report options can be set in ``exported_report`` config.
    * ``name_prefix`` will set a prefix to the generated report, e.g. ``name_prefix: "my_report"`` will generate ``reports/{timestamp}/my_report.csv``.
    * The app currently generates three format types, Domain reports in a single file, Path reports single and multiple files.
        * To set a report as Domain : ``report_type : "domain"``.
        * To set Path report on a single file use : ``report_type : { path : singleFile }``
        * To set Path report per domain file use : ``report_type : { path : multiFile }``

## Running the app
1. Download the sources using Git.
2. Navigate through the app folder: ``cd elb-access-log-analyzer``.
3. Inside the app folder, install the dependencies: ``npm install`` (may require sudo access).
4. Run the app using ``node app.js``. To switch to an environment config e.g. ``development`` use ``NODE_ENV=development node app.js``.

## Reports
Domain reports (single file):

<table border="0">
<tr>
<th>domainName</th><th>totalDomainCount</th>
</tr>
<tr>
<td>example.com</td><td>1</td>
</tr>
<tr>
<td>example1.com</td><td>2</td>
</tr>
<tr>
<td>example2.com</td><td>3</td>
</tr>
</table>

Domain Reports by Path (single file):
<table border="0">
<tr>
<th>domainName</th><th>path</th><th>pathCount</th>
</tr>
<tr>
<td>example.com</td><td>/</td><td>1</td>
</tr>
<tr>
<td>example.com</td><td>/some-path</td><td>1</td>
</tr>
<tr>
<td>example1.com</td><td>/another-path </td><td>2</td>
</tr>
<tr>
<td>example1.com</td><td>/another-path2 </td><td>1</td>
</tr>
<tr>
<td>example2.com</td><td>/?s=123 </td><td>1</td>
</tr>
<tr>
<td>example2.com</td><td>/?s=456</td><td>1</td>
</tr>
</table>


Reports by path (multiple files) format will be the same as above only they are separated into files by domain:
``reports/{timestamp}/example.com.csv``
``reports/{timestamp}/example1.com.csv`` etc.

## Version 0.2
* ELB Log Analyzer have been reworked.
* Performance should be stable and report generated should be more reliable.
* App now uses the level library for storing key-value pairs. This is to handle massive memory load of the reports by path previously saved into memory which causes memory leaks.
* App should be able to generate whole day reports for domain paths as a single file and domain paths report per domain (multi-file).
* Contains bug fixes

##Contributors
[@ramalveyra](https://github.com/ramalveyra)

##Credits
John Gruber for url extraction