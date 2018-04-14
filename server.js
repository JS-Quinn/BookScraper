// Dependencies
var express = require("express");
var exphbs = require("express-handlebars");
var mongojs = require("mongojs");
var mongoose = require("mongoose");
var request = require("request");
var cheerio = require("cheerio");
var logger = require("morgan");
var body = require("body-parser");
var method = require("method-override");
var axios = require("axios");

// Require models
var Note = require("./models/Note");
var Article = require("./models/Article");

// Connect mongoose to MongoDB

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/scraper";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, {
  //useMongoClient: true
});

// Initialize Express

var app = express();
var port = process.env.PORT || 8080;

app.use(logger("dev"));
app.use(express.static("public"));
app.use(body.urlencoded({extended: false}));
app.use(method("_method"));
app.engine("handlebars", exphbs({defaultLayout: "main"}));
app.set("view engine", "handlebars");

// Routes

app.get("/", function(req, res) {
  Article.find({}, null, {sort: {created: -1}}, function(err, data) {
    if(data.length === 0) {
      res.render("placeholder", {message: "Click the scrape button to populate."});
    }
    else {
      res.render("index", {articles: data});
    }
  })
});

app.get("/scrape", function(req, res) {
  axios.get("http://books.toscrape.com/").then(function(response) {
    var $ = cheerio.load(response.data);

    $("article h3").each(function(i, element) {
      var result = {};

      result.title = $(this)
        .children("a")
        .text();
      result.link = "http://books.toscrape.com/" + $(this)
        .children("a")
        .attr("href");

      Article.create(result)
        .then(function(dbArticle) {
          console.log(dbArticle);
        })
        .catch(function(err) {
          return res.json(err);
        });
    });
    res.redirect("/");
  });
});

app.get("/saved", function(req, res) {
  Article.find({issaved: true}, null, {sort: {created: -1}}, function(err, data) {
    if(data.length === 0) {
			res.render("placeholder", {message: "You have not saved any books yet."});
		}
		else {
			res.render("saved", {saved: data});
		}
  })
});

app.get("/:id", function(req, res) {
  Article.findById(req.params.id, function(err, data) {
    res.json(data);
  })
});

app.post("/save/:id", function(req, res) {
  Article.findById(req.params.id, function(err, data) {
    if (data.issaved) {
      Article.findByIdAndUpdate(req.params.id, {$set: {issaved: false, status: "Save Book"}}, {new: true},function(err, data) {
      });
    }
    else {
      Article.findByIdAndUpdate(req.params.id, {$set: {issaved: true, status: "Saved"}}, {new: true}, function(err, data) {
      });
    }
    res.redirect("/");
  });
});

app.post("/note/:id", function(req, res) {
  var note = new Note(req.body);
  note.save(function(err, doc) {
    if (err) throw err;
    Article.findByIdAndUpdate(req.params.id, {$set: {"note": doc._id}}, {new: true}, function(err, newdoc) {
      if(err) throw err;
      else {
        res.send(newdoc);
      }
    });
  });
});

app.get("/note/:id", function(req, res) {
  var id = req.params.id;
  Article.findById(id).populate("note").exec(function(err, data) {
    res.send(data.note);
  })
});

// Listen on port 3000
app.listen(8080, function() {
  console.log("App running on port 8080!");
});
