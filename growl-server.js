/* Nodefly stuff */
var hostname = require('os').hostname();
var processNumber = process.env.INDEX_OF_PROCESS || 0;

var http = require('http');
var db   = require('./database');

/* Push Notification Configuration */
var apn = require('apn');
var options = {
  'gateway': 'gateway.sandbox.push.apple.com',
  'cert': 'GrowlersPushCert.pem',
  'key': 'GrowlersPushKey.pem'
}
var apnConnection = apn.Connection(options);
var pushNote = new apn.Notification();
pushNote.badge = 1;
pushNote.expiry = Math.floor(Date.now() / 1000 + (3600 * 4)); // expire in 4 hours

/* APN Feedback */
var feedbackOptions = {
  "batchFeedback": true,
  "interval": (60*60*12)
}

var feedback = new apn.Feedback(options);
feedback.on("feedback", function(devices) {
  console.log("Performing actions for Feedback recieved from APN");
  devices.forEach(function(item) {
    console.log('Item recieved from Feedback');
    console.log(item);
    db.removeUdidFromFeedback(item.device);
  });
});

// TODO: Setup necessary check from apple to
// remove UDIDs that have deleted app/clean up
// Failed push notifications

var response = '';
var html;

var beerJSON = [];

setInterval(getData(), (1000*60)*10);
// Another attempt at setInterval error fixing
//setInterval(function() { getData() }, (1000*60)*10);


function getData() {
  console.log('' + timeStamp(new Date())  + 'Requesting Data from Growl Movement...');
  http.get('http://www.growlmovement.com/taplist/', function(res) {
    res.on('data', function(chunk) {
      response = response.concat(chunk.toString());
    });
    res.on('end', function() {

      html = response;

      var start = html.indexOf('class="tabltap"'); // returns index of that element

      var end = html.indexOf('</table>');

      var content = html.slice(start, end);

      var list = content.split('<tr');
      list.shift();
      list.shift();

      list.forEach(function(item) {

        listItems = item.split('<td');
        var tapID = parseInt(getTapID(listItems[1]));
        var beerInfo = listItems[2];
        var cost = listItems[3];
        var beerName = getBeerName(beerInfo);
        var brewer = getBrewer(beerInfo);
        var brewURL = getBeerURL(beerInfo);
        var ibu = getIBUs(beerInfo);
        var abv = getABV(beerInfo);
        var costs = getBeerCost(cost);
        beerJSON.push({
          "tap_id": tapID,
          "name" : beerName,
          "brewer": brewer,
          "brew_url" : brewURL,
          "ibu" : ibu,
          "abv" : abv,
          "growler" : costs.growler,
          "growlette" : costs.growlette
        }); // end beerJSON.push
      }); // end forEach
      notifyUsers(beerJSON);
    }); // end res.end
  });
  console.log('' + timeStamp(new Date()) + 'Data Received from Growl Movement.');
}

function timeStamp(date) {
  return "" + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + " - " + date.getDate() + "/" + date.getMonth() + "/" + date.getFullYear() + "  --  ";
}

function getTapID(idStr) {
  return idStr.split('>')[2].split('</')[0];
}

function getBeerName(beer) {
  return beer.split('<b>')[1].split('</b>')[0];
}

function getBrewer(beer) {
  // console.log(beer);
  var brewer = beer.split('<a')[1];
  // console.log(brewer)
  // console.log(brewer);
  if(brewer) {
    return beer.split('<a')[1].split('</a')[0].split('>')[1];
  }
  else {
    return beer.split(' - ')[1].split('<')[0];
  }
  return '';
}

function getBeerURL(beer) {
  var brewerURL = beer.split('href=')[1];
  if (brewerURL) {
    return brewerURL.split(' ')[0];
  }
  else {
    return '';
  }
}

function getOtherBeerInfo(beer) {
  return beer.split('<br')[1] || '';
}

function getIBUs(beer) {
  var IBU = getOtherBeerInfo(beer);
  if(!IBU) return '';
  var ibu = IBU.toLowerCase().split('ibu:')[1];
  if(ibu) return ibu.split('abv:')[0].trim();
  else return ''
}
function getABV(beer) {
  var ABV = getOtherBeerInfo(beer);
  if(!ABV) return '';
  var abv = ABV.toLowerCase().split('abv:')[1]
  if(abv) return abv.split('</')[0].trim();
  else return '';
}

function getBeerCost(beer) {
  var costs = beer.split('/');
  var growler = costs[0].split('>')[2].trim();
  var growlette = costs[1].split('<')[0].trim();
  return {
    "growler" : growler.substr(5), // strip off all of '&#36;'
    "growlette" : growlette.substr(5)
  };
}

function notifyUsers(newList) {
  db.checkForNewBeers(newList, function(oldBeers, newBeers) {
    newBeers = newList;
    console.log('' + timeStamp(new Date()) + 'Checking for new beers');

    // console.log('##\tBeer list verifications');
    // console.log('\t\toldBeers.count = ' + oldBeers.length);
    // console.log('\t\tnewBeers.count = ' + newBeers.length);

    for(var i = 0; i < newBeers.length; i++) {
      var flag = false;
      for(var j = 0; j < oldBeers.length; j++) {
        flag = oldBeers[j].name == newBeers[i].name && oldBeers[j].brewer == newBeers[i].brewer;
        if (flag == true) break;
      }
      if (!flag) {
        db.getFavoritesForBeer(newBeers[i], function(favorites, name) {

          // console.log('Favorite Found!');
          // console.log('Sanity checks');
          // console.log('favorites length - ' + favorites.length);
          // console.log('favorites contents - ' + favorites);
          // console.log('Beer name - ' + newBeers[i].name);

          for(var c = 0; c < favorites.length; c++) {
            pushNote.alert = '' + name + ' is back on tap!';
            var device = new apn.Device(favorites[c]);
            apnConnection.pushNotification(pushNote, device);
          }
        }); // end !flag callback
      } // end if !flag
    } // end outer for
    db.setAvailableBeers(newList);
  }); // end checkForNewBeers callback
} // end function

var requestListener = function(req, res) {
  if (req.method == 'GET') {
    res.writeHead(200,{
      "Content-Type": "application/json"
    });
    if (req.url == '/') {
      res.write(JSON.stringify(beerJSON));
      res.end();
    }
    else if (req.url == '/all') {
      db.getAllBeers(function(list) {
        // once this gets results, this will work
        res.write(JSON.stringify(list));
        res.end();
      });
    }
  } // end 'GET'
  else if (req.method == 'POST') {
    var request = ''; // create var request so i can reference later
    req.on('data', function(chunk) {
      request = request.concat(chunk.toString());
    }); // end on 'data'
    req.on('end', function() {
      request = JSON.parse(request);
      var regex = /^(\w*|\s*)*$/img;
      var sanityCheck =
        request.name.match(regex) !== null &&
        request.brewer.match(regex) !== null &&
        request.udid.match(regex) !== null;
        console.log('POST sanity check - ' + sanityCheck);
      if (request.fav == true && sanityCheck) {
        db.favorite(request);
        res.writeHead(200,{
          "Content-Type": "application/json"
        });
      }
      else if (sanityCheck) {
        db.unfavorite(request);
        res.writeHead(200, {
          "Content-Type": "application/json"
        });
      }
      else {
        res.writeHead(400, {
          "Content-Type": "application/json"
        });
        res.end(JSON.stringify({error: "invalid data supplied"}));
      }
      res.end(JSON.stringify({complete: true}));
    }); // end on 'end'
  }
  else { // invalid request
    res.writeHead(500);
    res.end(JSON.stringify({'error': 'invalid HTTP method'}));
  }

}

var server = http.createServer(requestListener);
server.listen(8000);
