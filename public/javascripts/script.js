var mapData, canvas, ctx;
var dragStart,dragged;
var mousePos = {x:0,y:0};
var zoomLevel = 0.5;
var fontSize = 2;
var initialPlanetRadius = 2
var planetRadius = initialPlanetRadius / zoomLevel;
var selectedPlanet = {};
var offscreen_canvas, offscreen_context;

$(document).ready(function(){
	
	canvas = document.getElementById('map');
	ctx = canvas.getContext('2d');
	responsiveCanvas();
	offscreen_canvas = document.createElement('canvas');
	offscreen_canvas.width = canvas.width;
	offscreen_canvas.height = canvas.height;
	offscreen_context = offscreen_canvas.getContext('2d');

	$(window).resize( function () {
		responsiveCanvas();
		offscreen_canvas.width = canvas.width;
		offscreen_canvas.height = canvas.height;
	});

	trackTransforms(ctx);
	trackTransforms(offscreen_context);

	getMapData('https://static.mwomercs.com/data/cw/mapdata.json');

    //Initial viewport
	offscreen_context.translate(canvas.width / 2,canvas.height / 2);
	offscreen_context.scale(zoomLevel,zoomLevel);

    var lastX=canvas.width/2, lastY=canvas.height/2;

    canvas.addEventListener('mousedown',function(evt){
        document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragStart = offscreen_context.transformedPoint(lastX,lastY);
        dragged = false;
    },false);

    canvas.addEventListener('mousemove',function(evt){
        if(mapData) {
        	if(getMousePos(canvas,evt)) {
        		redraw(); // Only redraw if needed (User is mousing over a planet)
        	};
	        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
	        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
	        dragged = true;
	        if (dragStart){
	            var pt = offscreen_context.transformedPoint(lastX,lastY);
	            offscreen_context.translate(pt.x-dragStart.x,pt.y-dragStart.y);
	            redraw();
	        }
	    }
    },false);

    canvas.addEventListener('mouseup',function(evt){
        dragStart = null;
        if (!dragged) zoom(evt.shiftKey ? -1 : 1 );
    },false);

    var scaleFactor = 1.1;

    var zoom = function(clicks){
        var pt = offscreen_context.transformedPoint(lastX,lastY);
        offscreen_context.translate(pt.x,pt.y);
        var factor = Math.pow(scaleFactor,clicks);
        zoomLevel = offscreen_context.getTransform().a;
        if(zoomLevel > 1) {
			planetRadius = initialPlanetRadius;
		} else {
			planetRadius = initialPlanetRadius / zoomLevel;
		}
        offscreen_context.scale(factor,factor);
        offscreen_context.translate(-pt.x,-pt.y);
        redraw();
    }

    var handleScroll = function(evt){
        var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
        if (delta){
    		if(zoomLevel > 0.4 || delta > 0) {
        		zoom(delta);
        	}
        } 
        return evt.preventDefault() && false;
    };

    function getMousePos(canvas, evt) {
		var rect = canvas.getBoundingClientRect();
		mousePos = offscreen_context.transformedPoint(evt.clientX - rect.left, evt.clientY - rect.top);
		return trackHoverPlanet(mousePos);
	}

    canvas.addEventListener('DOMMouseScroll',handleScroll,false);
    canvas.addEventListener('mousewheel',handleScroll,false);
})

function redraw(){
    // Clear the entire canvas
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    offscreen_context.save();
    offscreen_context.setTransform(1,0,0,1,0,0);
    offscreen_context.clearRect(0,0,offscreen_canvas.width,offscreen_canvas.height);
    offscreen_context.restore();	

    if(mapData) {
    	drawMap(offscreen_context);
    	ctx.drawImage(offscreen_canvas, 0, 0);
    	//requestAnimationFrame(redraw); // Hooo, this uses some cycles! Let's develop some more before we optimize any more.
    }    
}

// Adds ctx.getTransform() - returns an SVGMatrix
// Adds ctx.transformedPoint(x,y) - returns an SVGPoint
function trackTransforms(ctx){
	var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
	var xform = svg.createSVGMatrix();
	ctx.getTransform = function(){ return xform; };

	var savedTransforms = [];
	var save = ctx.save;
	ctx.save = function(){
		savedTransforms.push(xform.translate(0,0));
		return save.call(ctx);
	};

	var restore = ctx.restore;
		ctx.restore = function(){
	    xform = savedTransforms.pop();
	    return restore.call(ctx);
	};

	var scale = ctx.scale;
		ctx.scale = function(sx,sy){
    	xform = xform.scaleNonUniform(sx,sy);
    	return scale.call(ctx,sx,sy);
	};

	var rotate = ctx.rotate;
		ctx.rotate = function(radians){
		xform = xform.rotate(radians*180/Math.PI);
		return rotate.call(ctx,radians);
	};

	var translate = ctx.translate;
		ctx.translate = function(dx,dy){
		xform = xform.translate(dx,dy);
		return translate.call(ctx,dx,dy);
	};

  	var transform = ctx.transform;
  	ctx.transform = function(a,b,c,d,e,f){
		var m2 = svg.createSVGMatrix();
		m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
		xform = xform.multiply(m2);
		return transform.call(ctx,a,b,c,d,e,f);
  	};

  	var setTransform = ctx.setTransform;
  	ctx.setTransform = function(a,b,c,d,e,f){
		xform.a = a;
		xform.b = b;
		xform.c = c;
		xform.d = d;
		xform.e = e;
		xform.f = f;
      	return setTransform.call(ctx,a,b,c,d,e,f);
  	};

  	var pt  = svg.createSVGPoint();
  	ctx.transformedPoint = function(x,y){
      pt.x=x; pt.y=y;
      return pt.matrixTransform(xform.inverse());
	}
}

var getMapData = function(url) {
	$('.loading-animation').show();
	$.get( url, function( data ) {
		$('.loading-animation').hide();
		mapData = data;
		$('#date').text('Generated: ' + data.generated);
		$('#date').data('date', data.generated);
		redraw();
	});
}

function writeMousePosition() {
		var message = 'Mouse position: ' + mousePos.x + ',' + mousePos.y + ', zoom: ' + zoomLevel;
        ctx.font = '12pt Calibri';
        ctx.fillStyle = 'white';
        ctx.fillText(message, 10, 25);
    }


function responsiveCanvas(){ 
    $('#map').attr('width', $('#map').width() ); //max width
    $('#map').attr('height', $('#map').height() ); //max height
}

function drawMap(context) {
	// Let's create a radial gradient for our lines and circles
	var gradient = context.createRadialGradient(0, 0, 300, 0, 0, 600);
	gradient.addColorStop(0, '#2E262F');
	gradient.addColorStop(1, '#004CB3');
	context.strokeStyle = gradient;
	context.lineWidth = 1 / zoomLevel;

	var sectors = 20; // How many segments in our starmap
	var r = 2600; // How far our should we draw the lines? TODO: Make'em go forever?

	context.beginPath();
	for(var i = 1; i <= sectors; i++) {
		// Draw some pretty lines. Doing it this way is more efficient than drawing all the lines from the edge of the circle, even though this method doubles the number of lines we draw.
    	var x = r * Math.cos(2 * Math.PI * i / sectors);
    	var y = r * Math.sin(2 * Math.PI * i / sectors);
		context.moveTo(0,0);
		context.lineTo(x,y);
	}
	for (var r = 200; r <= 2000; r+=200) {
		// Draw some pretty circles		
		context.arc(0, 0, r, 0, 2 * Math.PI, false);
	}
	context.stroke();
	context.closePath();

	
	$.each(mapData, function(){
		if(this.position && this.position.x && this.position.y) {
			context.beginPath();
			context.arc(this.position.x, -this.position.y, planetRadius, 0, 2 * Math.PI, false);
			context.fillStyle = getFactionColor(this);
			context.fill();
			context.closePath();
			
			if(this.selected) {
				context.beginPath();
				context.arc(this.position.x, -this.position.y, planetRadius + 4, 0, 2 * Math.PI, false);
				context.strokeStyle = 'cyan';
				context.lineWidth = 4;
				context.stroke();
				context.closePath();
			}
			else if(this.contested != 0) {
				context.beginPath();
				context.arc(this.position.x, -this.position.y, planetRadius + 4, 0, 2 * Math.PI, false);
				context.strokeStyle = 'red';
				context.lineWidth = 4;
	      		context.stroke();
	      		context.closePath();
      		}/* else if(this.unit.id != 0) { // This planet is owned by a player unit.
      			ctx.beginPath();
				ctx.arc(this.position.x, -this.position.y, planetRadius + 4, 0, 2 * Math.PI, false);
				ctx.strokeStyle = getFactionColor(this);
				ctx.lineWidth = 4;
	      		ctx.stroke();
	      		ctx.closePath();
      		}*/
		}
	});
	context.font = (fontSize).toFixed(0) + 'px sans-serif';
    context.fillStyle = 'white';
    context.strokeStyle = 'black';
	context.lineWidth = 0.2;
	$.each(mapData, function(){
		if(zoomLevel > 5 && this.position && this.position.x && this.position.y){
	        if(this.selected) {
	        	context.font = (fontSize * 2).toFixed(0) + 'px sans-serif';
	        }
	        var planetText = this.name;
	        if(this.unit.name!==''){
        		planetText += ' (' + this.unit.name + ')';
	        }
	        context.save();
			context.strokeText(planetText, parseInt(this.position.x) + 3,parseInt(-this.position.y) + 0.5);
			context.fillText(planetText, parseInt(this.position.x) + 3,parseInt(-this.position.y) + 0.5);
	        context.restore();
		    if(this.selected) {
	        	context.font = (fontSize).toFixed(0) + 'px sans-serif';
	        }
		}
	});
}

function getFactionColor(faction) {
	var factionID = faction.owner.id;
	//console.log(faction);
	if(faction.contested != 0) {
		return '#ff0000';
	}
	if(factionID == 0) {
		return '#ffffff';
	} else if(factionID == 1) { // PIRANHA GAMES
		return '#ffffff';
	} else if(factionID == 2) { // NONE
		return '#ffffff';
	} else if(factionID == 3) { // NONE
		return '#ffffff';
	} else if(factionID == 4) { // NONE
		return '#ffffff';
	} else if(factionID == 5) { // DAVION
		return '#ffff33';
	} else if(factionID == 6) { // KURITA
		return '#ff3300';
	} else if(factionID == 7) { // LIAO
		return '#005000';
	} else if(factionID == 8) { // MARIK
		return '#cc00cc';
	} else if(factionID == 9) { // RASALHAGUE
		return '#00ccff';
	} else if(factionID == 10) { // STEINER
		return '#0033cc';
	} else if(factionID == 11) { // SMOKE JAGUAR
		return '#707070';
	} else if(factionID == 12) { // JADE FALCON
		return '#00cc33';
	} else if(factionID == 13) { // WOLF
		return '#cc0000';
	} else if(factionID == 14) { // GHOST BEAR
		return '#3399ff';
	} else if(factionID == 15) { // NONE
		return '#ffffff';
	} else return '#ffffff';

}

function trackHoverPlanet(mousePos) {
    var hoveringOverAPLanet = false;
    $.each(mapData, function(){
        if(this.position && this.position.x && this.position.y) {
	        if (pointInCircle(mousePos, this)) {
	        	//TODO: Replace with get closest planet that also is in circle so we avoid double hits.
	            this.selected = true;
	            hoveringOverAPLanet = true;
	            if(selectedPlanet.name) {
	            	if(selectedPlanet.name !== this.name){
						selectedPlanet = this;
						showDetails(selectedPlanet);
					}
				} else {
					selectedPlanet = this;
					showDetails(selectedPlanet);
				}
	            return;
	        } else {
	        	this.selected = false;
	        }
	    }
    });
    return hoveringOverAPLanet;
}

function pointInCircle(point, shape) {
	//Is some point within some radius?
    var distX = Math.abs(point.x - shape.position.x),
        distY = Math.abs(point.y - -shape.position.y), // Coordinates are y-inverted on a canvas, so we multiply all values in the y-axis with -1
        dist = Math.sqrt(distX * distX + distY * distY);
    return dist < planetRadius * 2;
}

function showDetails (planet){
	// TODO: Replace with Angular or something like it. This is really rudimentary stuff, just to get something on screen...
	var owner = planet.owner.name;
	$('#planetname').text(planet.name);
	$('#planetowner').text(owner);
	if(planet.unit.name !== '') {
		owner = 'Unit: ' + planet.unit.name;
	} else owner = '';
	$('#planetownerunit').text(owner);
	$('#planetownerimage').attr('src',planet.owner.icon);
	$('#planetinvader').text(planet.invading.name);
	$('#planetinvaderimage').attr('src',planet.invading.icon);
	if(planet.contested != 0) {
		// Calculate how many territories have been taken. Thanks to iamatotalnoob on Reddit (http://www.reddit.com/u/iamatotalnoob) for the algorithm
		var sum = 0;
		for (var t = 0; t < 8; t++) {
			var territory = planet.territories[t];
			for (var i = 0; i < 8; i++) {
				sum += (0x1 & territory);
				territory = territory >> 1;
			}
		}
	}
	$('#planetinvaderterritoriesowned').text(sum);
}
