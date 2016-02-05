var fs = require("fs");
var es = require("event-stream");
var Rune = require("rune.js");
var printf = require("printf");
var colorString = require("color-string");

// convert xml node/tree to string.
function nodeToString(node, addNamespace)
{
	// open tag.
	var str = "<" + node.tagName;
	
	// add namespace attribute.
	if(addNamespace) str += ' xmlns="http://www.w3.org/2000/svg"';
	
	// add attributes.
	if(node.properties && node.properties.attributes)
	{
		var attrs = node.properties.attributes;
		for(var key in attrs)
		{
			if(attrs[key])
				str += ' ' + key + '=\"' + attrs[key].toString() + '"';
		}
	}
	
	str += ">";

	// add children.
	if(node.children)
	{
		node.children.forEach(function(child)
		{
			str += nodeToString(child);
		});
	}
	
	// close tag.
	str += "</" + node.tagName + ">";
	
	return str;
}

module.exports = function(outFile)
{
	var rune = null;
	var frame = 0;
	var previousInitializationData = null;
	
	var state = 
	{
		color: "#000000",
		pointSize: 0.5,
		lineWidth: 1.0,
	}
	
	var initializeRune = function(data)
	{
		if(!data) data = previousInitializationData;
		
		rune = new Rune(data);
		
		previousInitializationData = data;
	};
	
	initializeRune({width: 200, height: 200});
	
	var outputImage = function()
	{
		rune.draw();
		
		var tree = rune.renderer.tree;
		var el = rune.getEl();
		var str = nodeToString(tree, true);
	
		if(outFile)
		{
			// output to file.
			var fileName = printf(outFile, frame);
			var stream = fs.createWriteStream(fileName);
			stream.write(str);
			stream.end();
		}
		else
		{
			// output to stdout.
			console.log(str);
		}
		
		++frame;
	}	
	
	var _drawStack = new Array ();
	var op_counter = 0;
	
	var drawStack = function()
	{
		_drawStack = sortStack();		
		_drawStack = applyFrames(_drawStack);
		
		var keyframes = getMaxKeyFrame();
		var frame_step = 1;
		
		for(var frame_number = 0; frame_number < 1 || frame_number <= keyframes; frame_number += frame_step)
		{
			for (var key = 0; key < _drawStack.length; key++)
			{
				if(key > _drawStack.length || !_drawStack[key])
					continue;
				
				var type = _drawStack[key].type;
				var data = _drawStack[key].data;
				var identity = _drawStack[key].identity;
				var counter = _drawStack[key].op_counter;
				var current_frame = _drawStack[key].current_frame;
				var start_frame = _drawStack[key].start_frame;
				var end_frame = _drawStack[key].end_frame;
				var next_keyframe = _drawStack[key].next_keyframe;
				
				if(identity != ":")
				{
					if(start_frame > frame_number)
					{
						break;
					}
					else if(frame_number > end_frame)
					{						
						_drawStack[key] = null;				
						
						continue;
					}
				}
				
				_drawStack[key].current_frame = current_frame + frame_step;
				
				
				if(!type)
				{
					return;
				}
				else if(_drawStack[key].isProperty)
				{
					switch(type)
					{
						case "pointSize":
						{
							if(identity != ":")
								state.pointSize = data + Math.floor(_drawStack[key].dps * current_frame);
							else
								state.pointSize = data;
							break;
						}
						
						case "lineWidth":
						{
							if(identity != ":")
								state.lineWidth = data[0] + Math.floor(_drawStack[key].dps * current_frame);
							else
								state.lineWidth = data[0];// for some reason, this is an array.
							break;
						}
						
						case "color":
						{
							var color = data[0]; // this is an array, too.
							
							if(typeof(color) === "string")
							{
								// colors like red, green or #0000FF
								var rgb = colorString.getRgb(color)
								
								if(identity != ":")
									state.color = new Rune.Color(rgb[0] + Math.floor(_drawStack[key].dr * current_frame), rgb[1] + Math.floor(_drawStack[key].dg * current_frame), rgb[2] + Math.floor(_drawStack[key].db * current_frame));
								else
									state.color = new Rune.Color(rgb[0], rgb[1], rgb[2]);
								
							}	
							else if (typeof(color) === "object")
							{
								// RGB color {x:255, y:0, z:255}
								if(identity != ":")
									state.color = new Rune.Color(color.x + Math.floor(_drawStack[key].dr * current_frame), color.y + Math.floor(_drawStack[key].dg * current_frame), color.z + Math.floor(_drawStack[key].db * current_frame));
								else
									state.color = new Rune.Color(color.x , color.y, color.z);
							}
							else
							{
								throw new Error("Invalid color " + color);
							}
							
							break;
						}
					}
				}
				else
				{
					switch(type)
					{
						case "push":
						{
							// clone state.
							var newState = {}
							for(var _temp in state)
								newState[_temp] = state[_temp];
		
							// save old state and replace current state.
							newState.oldState = state;
							state = newState;
							next_keyframe = -1;
							break;
						}
						
						case "pop":
						{
							if(!state.oldState)
								throw new Error("Tried to pop state stack, but the stack is empty.");
							
							// restore old state.
							state = state.oldState;
							next_keyframe = -1;
							break;
						}
						
						case "lines":
						{
							
							for(var i = 0; i < data.length; i += 2)
							{
								var start = data[i];
								var end = data[i + 1];
								if(identity != ":")
									rune.line(start.x + Math.floor(start.dx *current_frame), start.y + Math.floor(start.dy *current_frame), end.x + Math.floor(end.dx *current_frame), end.y + Math.floor(end.dy *current_frame)).strokeWidth(state.lineWidth).stroke(state.color).fill(false);
								else
									rune.line(start.x , start.y, end.x , end.y).strokeWidth(state.lineWidth).stroke(state.color).fill(false);
							}
							
							break;
						}
						
						case "polyline":
						{
							var r = rune.path(0, 0);
							
							for(var i = 0; i < data.length; i++)
							{
								if(identity != ":")
									r = r.lineTo(data[i].x + Math.floor(data[i].dx *current_frame), data[i].y + Math.floor(data[i].dy *current_frame));
								else
									r = r.lineTo(data[i].x, data[i].y);
							}
							
							r.strokeWidth(state.lineWidth).stroke(state.color).fill(false);
							
							break;
						}
							
						
						case "circles":
						{
							for(var i = 0; i < data.length; i++)
							{
								var circle = data[i];
								var pos = circle[0];
								var radius = circle[1];
								
								if(identity != ":")
									rune.circle(pos.x + Math.floor(data[i].dx *current_frame), pos.y + Math.floor(data[i].dy *current_frame), radius + Math.floor(data[i].dr *current_frame)).strokeWidth(state.lineWidth).stroke(state.color).fill(false);
								else
									rune.circle(pos.x, pos.y, radius).strokeWidth(state.lineWidth).stroke(state.color).fill(false);
							}
						
							break;
						}
						
						case "points":
						{
							for(var i = 0; i < data.length; i++)
							{
								var pos = data[i];
								if(identity != ":")
									rune.circle(pos.x + Math.floor(data[i].dx *current_frame), pos.y + Math.floor(data[i].dy *current_frame), state.pointSize).stroke(state.color).fill(state.color);
								else
									rune.circle(pos.x, pos.y, state.pointSize).stroke(state.color).fill(state.color);							
							}

							break;
						}
					}
				}
				
				if(frame_number > end_frame && identity != ":" && next_keyframe == -1)
				{
					_drawStack[key] = null;				
					continue;
				}
			}
					
			outputImage();
			initializeRune();
		}
	}
	
	var sortStack = function()
	{
		var _temp_stack = new Array();
		var _counter = 0;
		
		for (var i = 0; i < _drawStack.length; ++i)
		{
			var identity = _drawStack[i].identity;		
			
			if(identity != ":")
			{
				_temp_stack[_counter] = _drawStack[i];
				_counter++;
			}
		}
		
		for (var i = 0; i < _temp_stack.length-1; ++i)
		{
			for (var a = i; a < _temp_stack.length-1; ++a)
			{
				if(_temp_stack[a].start_frame > _temp_stack[a+1].start_frame)
				{
					var _temp = _temp_stack[a];
					_temp_stack[a] = _temp_stack[a+1];
					_temp_stack[a+1] = _temp;
				}
			}
		}
		
		for (var i = 0; i < _drawStack.length; ++i)
		{
			var identity = _drawStack[i].identity;		
			
			if(identity == ":")
			{
				var _found = false;
				for (var a = 0; a < _temp_stack.length; ++a)
				{
					if(_temp_stack[a].op_counter ==  _drawStack[i].op_counter - 1)
					{
						_temp_stack = insert(_temp_stack,a+1, _drawStack[i]);
						_found = true;
						break;
					}
				}
				
				if(!_found)
				{
					_temp_stack = insert(_temp_stack,0, _drawStack[i]);
				}
			}
		}
		
		return _temp_stack;
	}
	
	var insert = function(array, pos, data)
	{
		var _temp_stack = new Array(array.length +1);
		
		for (var i = 0; i < _temp_stack.length; ++i)
		{
			if(i == pos)
			{
				_temp_stack[i] = data;
				i++;
				if(i < _temp_stack.length)
				{
					_temp_stack[i] = array[i-1];
				}
			}
			else
			{
				_temp_stack[i] = array[i > pos ? i -1 : i];
			}
		}
		
		return _temp_stack;
	}
	
	var lastKeyFrame = function(identity, counter)
	{
		if(identity == ":")
		{
			for(var i = counter -1; i > 0; --i)
			{
				if(_drawStack[i].identity != ":" )
				{
					return i;
				}
			}
			
			return -1;
		}
		
		for(var i = counter -1 ; i > 0; --i)
		{
			if(_drawStack[i].identity == identity )
			{
				return i;
			}
		}
		
		return -1;
	}
		
	var nextKeyFrame = function(identity, counter)
	{
		if(identity == ":")
		{
			for(var i = counter + 1; i < _drawStack.length; ++i)
			{
				if(_drawStack[i].identity != ":" )
				{
					return i;
				}
			}
			
			return -1;
		}
		
		for(var i = counter + 1; i < _drawStack.length; ++i)
		{
			if(_drawStack[i].identity == identity )
			{
				return i;
			}
		}
		
		return -1;
	}
	
	var getMaxKeyFrame = function()
	{
		var _keyframe = 0;
		
		for(var i = 0; i < _drawStack.length; ++i)
		{
			if(_drawStack[i].identity != ':' && _drawStack[i].start_frame > _keyframe)
			{
				_keyframe = _drawStack[i].start_frame;
			}
		}
		
		return _keyframe;
	}
	
	var applyFrames = function(array)
	{
		var keyframes = getMaxKeyFrame();
		
		for (var key = 0; key < _drawStack.length; key++)
		{
			if(array[key].identity ===  ":")
				continue;
			
			var type = array[key].type;
			var data = array[key].data;
			var identity = array[key].identity;
			var counter = array[key].op_counter;
			var current_frame = array[key].current_frame;
			var start_frame = array[key].start_frame;
			var nextframe = nextKeyFrame(identity,key);
			
			array[key].next_keyframe = nextframe;
			
			if(nextframe == -1)
			{
				continue;
			}
			
			array[key].end_frame = array[nextframe].start_frame;
			
			var end_frame = array[key].end_frame;
			var length = end_frame - start_frame;			
			
			if(!type)
			{
				return;
			}
			else if(_drawStack[key].isProperty)
			{
				switch(type)
				{
					case "pointSize":
					{
						var start = data;
						var end = array[nextframe].data;

						array[key].dps = (end - start)/length;	
						
						break;
					}
					
					case "lineWidth":
					{
						var start = data[0];
						var end = array[nextframe].data[0];

						array[key].dlw = (end - start)/length;
						break;
					}
					
					case "color":
					{
						var start = data[0];
						var end = array[nextframe].data[0];
						
						if (typeof(color) === "object" || start.x && start.y && start.z)
						{
							// RGB color {x:255, y:0, z:255}
							array[key].dr = (end.x - start.x)/length;
							array[key].dg = (end.y - start.y)/length;
							array[key].db = (end.z - start.z)/length;	
						}				
						else if(typeof(color) === "string" || start && end)
						{
							// colors like red, green or #0000FF
							var start_rgb = colorString.getRgb(start);
							var end_rgb = colorString.getRgb(end);
							array[key].dr = (end_rgb[0] - start_rgb[0])/length;
							array[key].dg = (end_rgb[1] - start_rgb[1])/length;
							array[key].db = (end_rgb[2] - start_rgb[2])/length;
						}
						else
						{
							throw new Error("Invalid color " + color);
						}
						
						break;
					}
				}
			}
			else
			{
				switch(type)
				{				
					case "lines":
					{
						
						for(var i = 0; i < data.length;  ++ i)
						{
							var start = data[i];
							var end = array[nextframe].data[i];

							array[key].data[i].dx = (end.x - start.x)/length;	
							array[key].data[i].dy = (end.y - start.y)/length;
							
						}
						
						break;
					}
					
					case "polyline":
					{
						for(var i = 0; i < data.length;  ++ i)
						{
							var start = data[i];
							var end = array[nextframe].data[i];

							array[key].data[i].dx = (end.x - start.x)/length;	
							array[key].data[i].dy = (end.y - start.y)/length;
							
						}
						
						break;
					}
						
					
					case "circles":
					{
						for(var i = 0; i < data.length;  ++ i)
						{
							var start = data[i];
							var end = array[nextframe].data[i];

							array[key].data[i].dx = (end[0].x - start[0].x)/length;	
							array[key].data[i].dy = (end[0].y - start[0].y)/length;
							array[key].data[i].dr = (end[1] - start[1])/length;
							
						}
						
						for(var i = 0; i < data.length; i++)
						{
							var circle = data[i];
							var pos = circle[0];
							var radius = circle[1];
							rune.circle(pos.x, pos.y, radius).strokeWidth(state.lineWidth).stroke(state.color).fill(false);
						}
					
						break;
					}
					
					case "points":
					{
						for(var i = 0; i < data.length;  ++ i)
						{
							var start = data[i];
							var end = array[nextframe].data[i];

							array[key].data[i].dx = (end.x - start.x)/length;	
							array[key].data[i].dy = (end.y - start.y)/length;
							
						}
						
						break;
					}
				}
			}
		}
		
		for (var key = 0; key < _drawStack.length; key++)
		{
			if(array[key].identity !==  ":")
				continue;
			
			var type = array[key].type;
			var data = array[key].data;
			var identity = array[key].identity;
			var counter = array[key].op_counter;
			var current_frame = array[key].current_frame;
			var start_frame = array[key].start_frame;
			var nextframe = nextKeyFrame(identity,key);
			var lastframe = lastKeyFrame(identity,key);
			
			array[key].next_keyframe = nextframe;
						
			array[key].start_frame = lastframe == -1 ? 0 : array[lastframe].start_frame;
		
			array[key].end_frame = lastframe == -1 ? (nextframe != -1 ? (array[nextframe].start_frame == -1 ? array[key].start_frame : array[nextframe].start_frame ) : array[key].start_frame) : (array[lastframe].end_frame == -1 ? array[key].start_frame : array[lastframe].end_frame); //nextframe == -1 ? keyframes : (array[nextframe].start_frame == - 1 ? keyframes :  array[nextframe].end_frame);
			
			//console.log(key + "   c: "+counter+" kc: "+array[nextframe].op_counter+"  nk: "+nextframe+"  lk: "+lastframe+"  s: " + array[key].start_frame + "    e: " + array[key].end_frame);
		}
		
		return array;
	}
	
	var addNewData = function(type,data,current_frame,identity,isProperty)
	{
		_drawStack[op_counter] = { type: type ,op_counter:op_counter, data:data, current_frame:0, start_frame:current_frame, identity:identity , nextframe:-1 , end_frame: -1 , isProperty: isProperty  };
		op_counter++;
	}
	
	return es.through(
		function write(input)
		{
			var type = input.type;
			var data = input.data;
			
			if(!type)
			{
				return;
			}
			else if(input.isProperty)
			{
				switch(type)
				{
					case "pointSize":
					{
						if(input.extention)
						{
							var extention = input.extention;
							
							switch(extention.type)
							{
								case "keyframe":
									var identity = input.extention.identity;
									var current_frame = input.extention.current_frame;
									
									addNewData(type, data, current_frame, identity,input.isProperty);
									
									break;
							}
						}
						else
						{
							addNewData(type, data, frame, ":",input.isProperty);
						}
						
						break;
					}
					
					case "lineWidth":
					{
						if(input.extention)
						{
							var extention = input.extention;
							
							switch(extention.type)
							{
								case "keyframe":
									var identity = input.extention.identity;
									var current_frame = input.extention.current_frame;
									
									addNewData(type, data, current_frame, identity,input.isProperty);
									
									break;
							}
						}
						else
						{
							addNewData(type, data, frame, ":",input.isProperty);
						}
						
						break;
					}
					
					case "color":
					{
						if(input.extention)
						{
							var extention = input.extention;
							
							switch(extention.type)
							{
								case "keyframe":
									var identity = input.extention.identity;
									var current_frame = input.extention.current_frame;
									
									addNewData(type, data, current_frame, identity,input.isProperty);
									
									break;
							}
						}
						else
						{
							addNewData(type, data, frame, ":",input.isProperty);
						}
						
						break;
					}
					
					default:
						throw new Error("Invalid state property: " + type);
				}
			}
			else
			{
				switch(type)
				{
					case "initialize":
					{
						initializeRune(data);
					
						break;
					}
					
					case "ignore":
					{						
						break;
					}
					
					case "newframe":
					{
						outputImage();
						initializeRune();
						
						break;
					}
					
					case "push":
					{
						addNewData(type, data, frame, ":",input.isProperty);
						break;
					}
					
					case "pop":
					{
						addNewData(type, data, frame, ":",input.isProperty);
						break;
					}
						
					case "lines":
					{
						if(input.extention)
						{
							var extention = input.extention;
							
							switch(extention.type)
							{
								case "keyframe":
									var identity = input.extention.identity;
									var current_frame = input.extention.current_frame;
									
									addNewData(type, data, current_frame, identity,input.isProperty);
									
									break;
							}
						}
						else
						{
							addNewData(type, data, frame, ":",input.isProperty);
						}
						
						break;
					}
					
					case "polyline":
					{
						if(input.extention)
						{
							var extention = input.extention;
							
							switch(extention.type)
							{
								case "keyframe":
									var identity = input.extention.identity;
									var current_frame = input.extention.current_frame;
									
									addNewData(type, data, current_frame, identity,input.isProperty);
									
									break;
							}
						}
						else
						{
							addNewData(type, data, frame, ":",input.isProperty);
						}
						
						break;
					}
						
					
					case "circles":
					{
						if(input.extention)
						{
							var extention = input.extention;
							
							switch(extention.type)
							{
								case "keyframe":
									var identity = input.extention.identity;
									var current_frame = input.extention.current_frame;
									
									addNewData(type, data, current_frame, identity,input.isProperty);
									
									break;
							}
						}
						else
						{
							addNewData(type, data, frame, ":",input.isProperty);
						}
					
						break;
					}
					
					case "points":
					{
						if(input.extention)
						{
							var extention = input.extention;
							
							switch(extention.type)
							{
								case "keyframe":
									var identity = input.extention.identity;
									var current_frame = input.extention.current_frame;
									
									addNewData(type, data, current_frame, identity,input.isProperty);
									
									break;
							}
						}
						else
						{
							addNewData(type, data, frame, ":",input.isProperty);
						}

						break;
					}
					
					default:
						throw new Error("Invalid command: " + type);
				}
			}
		},
		function end()
		{			
			drawStack();
			//outputImage();
		}
	);
}

