// save environment variables in dotenv
require('dotenv').config();

// express set up, handles request, response easily
const express = require('express');
const app = express();
const traverse = require('traverse');

// express session
const session = require('express-session');

// makes sending requests easy
const request = require('request');

// node core module, construct query string
const qs = require('querystring');

// node core module, parses url string into components
const url = require('url');

// generates a random string for the
const randomString = require('randomstring');

// random string, will be used in the workflow later
const csrfString = randomString.generate();

// setting up port and redirect url from process.env
// makes it easier to deploy later
const port = process.env.PORT || 3000;
const redirect_uri = process.env.HOST + '/redirect';
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;

// serves up the contnests of the /views folder as static 
app.use(express.static('views'));

// initializes session
app.use(
    session({
        secret: randomString.generate(),
        cookie: { maxAge: 60000 },
        resave: false,
        saveUninitialized: false
    })
);

app.get('/', (req, res, next) => {
    res.sendFile(__dirname + '/index.html');
});



app.get('/login', (req, res, next) => {
    // generate that csrf_string for your "state" parameter
    req.session.csrf_string = randomString.generate();
    // construct the forge URL you redirect your user to.
    // qs.stringify is a method that creates foo=bar&bar=baz
    // type of string for you.
    const forgeAuthUrl = 'https://developer.api.autodesk.com/authentication/v1/authorize?' +
        qs.stringify({
            response_type: 'code',
            client_id: client_id,
            redirect_uri: redirect_uri,
            scope: 'data:read'
        });
    // redirect user with express
    res.redirect(forgeAuthUrl);
});

// Handle the response your application gets.
// Using app.all make sures no matter the provider sent you
// get or post request, they will all be handled
app.all('/redirect', (req, res) => {
    // Here, the req is request object sent by forge
    console.log('Request sent by forge: ');
    console.log(req.query);
    // req.query should look like this:
    // {
    //   code: '3502d45d9fed81286eba',
    // }
    const code = req.query.code;
    request.post(
        {
            url: 'https://developer.api.autodesk.com/authentication/v1/gettoken',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            form: {
                client_id: client_id,
                client_secret: client_secret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirect_uri
            }

        },
        (error, response, body) => {
            // The response will contain your new access token
            // this is where you store the token somewhere safe
            // for this example we're just storing it in session
            console.log('Your Access Token: ');
            console.log(JSON.parse(body));
            req.session.access_token = JSON.parse(body).access_token;

            // Redirects user to /user page so we can use
            // the token to get some data.
            res.redirect('/user');
        }
    );



});

app.get('/user', (req, res) => {
    request.get(
        {
            url: 'https://developer.api.autodesk.com/userprofile/v1/users/@me',
            headers: {
                Authorization: 'Bearer ' + req.session.access_token
            }
        },
        (error, response, body) => {

            var output = JSON.parse(body);
            var p = output.profileImages;
            var img = "";
            traverse(p).forEach(function (x) {
                img += "<img src=" + x + "/>";
            });

            //console.log(profileImages);
            res.send(
                "<p>You're logged in </p>" + "<p>" + output.userName + "</br>" + output.firstName + "," + output.lastName + "</br>" + "</p>" +
                img +
                '<p>Go back to <a href="/">log in page</a>.</p>'
            );
        }
    );
});

app.listen(port, () => {
    console.log('Server listening at port ' + port);
});