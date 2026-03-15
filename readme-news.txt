readme

this is a new folder which is going to be a news aggregator 
the idea is to put in some news sources (ideally rss feeds) and arrange them on a webpage
this should bypass all the paywalls possible, and use a unique font/colour for each source site. 
duplicate /similar articles should be able to be examined and filtered into left leaning/right leaning and given a tag accordingly.
this should all happen locally, either with a local small language model or via calls to claude api. 
we should keep a database of ingested articles (we will need to anyway for the web display) and try not to reclassify so as to keep token usage to a minimum
we should however detect when an article has been updated at the source and update our side accordingly, so there should be an initial date in the database, along with an updated date. if the date of the article is not in the text we should try and determine the date based on other sites reporting of the same story and perhaps use an inferred_date or possible_date field instead. 
the first couple of sites to ingest should be as follows
cnn.com
bbc.com
stuff.co.nz
rnz.co.nz
interest.co.nz
aljazeera.com
smh.com.au

we will need to use techniques to get around paywalls, this might include looking the articles up on archive sites and retrieving the text from there. 
the display for the website should be of an old style new york times front page, with a "article of the day" headline generated. each day we can perhaps scroll down a few pages of top stories, and then be able to click to the previous day. we don't want to overwhelm the user with news of the day, but there should also be an option to continue scrolling, but it needs to be an active choice of the user (so some kind of break should be apparent)
a user should be able to favourite topics and these should be ranked higher in preference, though breaking news should always be highest. 
use a modern design, but try and follow the old style new york times flow. 
