
var _ = require("lodash");
var parse = require("../lib/grammar.js").parse
var chai = require("chai");
chai.should();

describe("Parsing Commands", function(){
  it("parses a single point", function(){
    var point =
       ["point (1,2)",
        {
            type:"points",
            data: [{
                x: 1,
                y: 2
            }],
			extention:[{
				type: "keyframe"
			}]
        }];

    parse(point[0]).should.deep.equal(point[1]);
  });
  it("parses multiple points", function(){
    var point =
       ["points (1,2) 3 4",
        {
            type:"points",
            data: [
              {x: 1,y: 2},
              {x: 3,y: 4}
            ],
			extention:[{
				type: "keyframe"
			}]
        }];

    parse(point[0]).should.deep.equal(point[1]);
  });
  it("should ignore whitespaces", function(){
    var point =
        ["point  \t ( 10 , 0 )",
        {
            type: "points",
            data: [{
                x: 10,
                y: 0
            }],
			extention:[{
				type: "keyframe"
			}]
        }];
    parse(point[0]).should.deep.equal(point[1]);
  });
  it("should parse negative numbers", function(){
    var point =
        ["point   ( -10 , -5 )",
        {
            type: "points",
            data: [{
                x: -10,
                y: -5
            }],
			extention:[{
				type: "keyframe"
			}]
        }];
    parse(point[0]).should.deep.equal(point[1]);
  });
  it("can parse one line", function(){
    var line =
        ["line -10 -5 10 10",
        {
            type: "lines",
            data: [
              {x: -10,y: -5},
              {x:10,y:10}],
			extention:[{
				type: "keyframe"
			}]
        }];
    parse(line[0]).should.deep.equal(line[1]);
  });
  it("can parse multiple lines", function(){
    var lines =
        ["lines -10 -5 10 10 0 0 20 20",
        {
            type: "lines",
            data: [
              {x:-10,y:-5},
              {x:10,y:10},
              {x:0,y:0},
              {x:20,y:20}],
			extention:[{
				type: "keyframe"
			}]
        }];
    parse(lines[0]).should.deep.equal(lines[1]);
  });
  it("can parse a polyline", function(){
    var polyline =
        ["polyline -10 -5 10 10 0 0 20 20",
        {
            type: "polyline",
            data: [
              {x:-10,y:-5},
              {x:10,y:10},
              {x:0,y:0},
              {x:20,y:20}],
			extention:[{
				type: "keyframe"
			}]
        }];
    parse(polyline[0]).should.deep.equal(polyline[1]);
  });
  it("parses a single circle", function(){
    var circle =
       ["circle (1,2) 5",
        {
            type:"circles",
            data: [[{
                x: 1,
                y: 2
            },5]],
			extention:[{
				type: "keyframe"
			}]
        }];

    parse(circle[0]).should.deep.equal(circle[1]);
  });
  it("parses multiple circles", function(){
    var circles =
       ["circle (1,2) 5 2 2 10",
        {
            type:"circles",
            data: [
              [{x: 1,y: 2},5],
              [{x: 2,y: 2},10]
            ],
			extention:[{
				type: "keyframe"
			}]
        }];

    parse(circles[0]).should.deep.equal(circles[1]);
  });
  it("should reject negative radii", function(){
    (function(){parse("circle (1,2) -5");}).should.throw(Error);
  });
  it("detects Push commands", function(){
    parse("[").should.deep.equal({type:"push"});
  });

  it("detects Push commands", function(){
    parse("]").should.deep.equal({type:"pop"});
  });
});
