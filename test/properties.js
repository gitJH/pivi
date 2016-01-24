var _ = require("lodash");
var parse = require("../lib/grammar.js").parse
var chai = require("chai");
chai.should();

describe("Parsing Commands", function(){
  it("can parse the 'pointSize' property", function(){
    var property =
       ["set pointSize 7",
        {
            type:"pointSize",
            data: 7,
            isProperty: true,
			extention:[{
				type: "keyframe"
			}]
        }];

    parse(property[0]).should.deep.equal(property[1]);
  });
  it("doesn't accept negative pointSizes", function(){
    var pointSize = "set pointSize -7";

    (function(){parse(pointSize[0]);}).should.throw(Error);
  });
  it("can parse the 'lineWidth' property", function(){
    var property =
       ["set lineWidth 7",
        {
            type:"lineWidth",
            data: [7],
            isProperty: true,
			extention:[{
				type: "keyframe"
			}]
        }];

    parse(property[0]).should.deep.equal(property[1]);
  });
  it("doesn't accept negative lineWidth", function(){
    var pointSize = "set lineWidth -7";

    (function(){parse(pointSize[0]);}).should.throw(Error);
  });
  /* color tuples aren't supported yet
  it("can parse the 'color' property with an tupel", function(){
    var property =
       ["set color rgb 128 200 100",
        {
            type: "color",
            data: {x:128, y:200, z:100},
            isProperty: true
        }];

    parse(property[0]).should.deep.equal(property[1]);
  });*/
  it("can parse the 'color' property using color names", function(){
    var knownColors = ["red","green","blue"];
    _.each(knownColors, function(c){
      var property = ["set color " + c,
        {
            type: "color",
            data: [c],
            isProperty: true,
			extention:[{
				type: "keyframe"
			}]
        }];
        parse(property[0]).should.deep.equal(property[1]);
    });

  })
});
