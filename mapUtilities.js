var spatialsurvey = (function() {

	// ---------------------------------------------------------------
	var timeAndPlace = function(data)
	// ---------------------------------------------------------------
	//		data = 
	// 		{
	//			time     : number from 0 - 23
	// 			position : google.maps.LatLng object 
	// 		}
	{
		var that = {};

		var getTime = function() { return data.time; };
		that.getTime = getTime;

		var getPosition = function() { return data.position; };
		that.getPosition = getPosition; 

		return that;
	}

	// ----------------------------------------------------------------
	var TransitType = function() 
	// ----------------------------------------------------------------
	{
		//
	}

	// ----------------------------------------------------------------
	var personPath = function(data) 
	// ----------------------------------------------------------------
	/*		
		data = 
			{
				polyline 	   : Array of LatLng coordinates
				timestamps     : Array of TimeAt objects
				start-time	   : timeAndPlace objects
				end-time	   : timeAndPlace object
				transit-type   : 
				day			   : Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday 
		
				next-page-name : NOT USED in personPath
			}                                         
	*/
	{
		var data = data || {};
		var that = {};

		// verbose should be true only in a development environment
		var verbose = true;
		var polyline;
		var dataStringProperties = [];

		var debug = function(object, description) {
			if (verbose) {
				if (typeof description !== 'undefined')
					console.log(description);			
				console.log(object);			
			}
		}

		var setAttr = function(property, value) { data[property] = value; }
		var getAttr = function(property) { return data[property]; };

		// create getters, setters, and add property to the toString method
		var addProperty = function(property) {
			that['set' + property.capitalize()] = function(value) { setAttr(property, value); };
			that['get' + property.capitalize()] = function() { return getAttr(property); };

			dataStringProperties.push(property);
		}

		// takes an array of LatLng coordinates: i.e. input should be the result of polyline.getPath().getArray()
		var setPath = function(path) { data.polyline = path };
		that.setPath = setPath;

		// returns an array of LatLng coordinates
		var getPath = function() { return data.polyline || new Array(); };
		that.getPath = getPath;

		addProperty('startTime');
		addProperty('endTime');
		addProperty('timestamps');

		var getPolyline = function() {
			debug(getPath(), "getPath()");
			var polyline = new google.maps.Polyline({
				path: getPath(),
				strokeColor: '#000000',
				strokeWeight: 2,
				clickable: false			
			});
			return polyline;
		}
		that.getPolyline = getPolyline;

		var getTimes = function() { return data.timestamps || new Array(); };
		that.getTimes = getTimes;

		var toKML = function() {
			var kml = '<?xml version="1.0" encoding="UTF-8"?>'+
				'xmlns="http://www.opengis.net/kml/2.2"'+
				'<Document>'+
					'<name>FS Survey Response</name>'+
						'<description>FS Survey Response</description>'+
					'<Placemark>'+
						'<name>Path</name>'+
						'<description>none</description>'+
						'<LineString>'+
							'<altitudeMode>relative</altitudeMode>'+
							'<coordinates>'

			points = getPath().getArray();
			for (i = 0; i < points.length; i++) {
				kml += JSON.stringify(points[i].lat()) + ',' + JSON.stringify(points[i].lng()) + '\n';
			}

			kml +=			'</coordinates>'+
						'</LineString>'+
					'</Placemark>'+
				'</Document>'

			return kml;
		};
		that.toKML = toKML;

		var toString = function() {
			var stringable = new Object();		
			stringable.polyline = data.polyline.map(function(p) { return { lat: p.lat(), lng: p.lng() }; });
			for (i = 0; i < dataStringProperties.length; i++) {
				var name = dataStringProperties[i];
				if (data.hasOwnProperty(name)) { stringable[name] = data[name]; };	
			}
			return JSON.stringify(stringable); 
		};
		that.toString = toString;

		var display = function(map, callback) {
			load(function(){
				getPolyline().setMap(map);
				addTimestampMarker(map, getPolyline(), getPath()[0]);
				addTimestampMarker(map, getPolyline(), getPath().last());
			}, callback);	
		};
		that.display = display;

		// load data from previous screens
		var load = function(internalCallback, userCallback) {
			conn = new XMLHttpRequest();
			conn.overrideMimeType('application/json');
			conn.open('GET', '../polyline.php', true);
			conn.onreadystatechange = function() {
				if (this.readyState !== 4 ) return; 
				if (this.status !== 200 ) return; 
				debug(this.responseText);
				data = eval("(" + JSON.parse(this.responseText) + ")");
				setPath(data.polyline.map(createLatLng));
				debug(toString(), "toString()");
				internalCallback();
				userCallback();
			};
			conn.send();
		}

		return that;
	}

	var createLatLng = function(coord) {
		return new google.maps.LatLng(coord.lat, coord.lng);
	}

	var getContainer = function(doc, matchClass) {
		inputs = new Array(); 
	    var elems = doc.getElementsByTagName('*'), i;
	    for (i in elems) {
	        if((' ' + elems[i].className + ' ').indexOf(' ' + matchClass + ' ')
	                > -1) {
	        	inputs.push(elems[i]);
	        }
	    }
	    return inputs;
	}

	/* Add elements to the page */

	var showButton = function(map, doc, data, destination, addToData, type) {
		var nextForm = doc.createElement('form');
		nextForm.id = type + '-form';
		nextForm.setAttribute('method', 'post');
		nextForm.setAttribute('action', '../advance.php');
		nextForm.innerHTML = '<input type="hidden" name="' + type + '-name" id="' + type + '-name" value="' + destination + '"/>'+
								'<input type="hidden" name="path-data" id="' + type + '-path-data"/>'+
								'<input type="submit" id="' + type + '-button" value="NEXT"/>';
		map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(nextForm);	

		google.maps.event.addDomListener(nextForm, 'click', function() {
			var pathData = doc.getElementById(type + '-path-data');
			if (typeof addToData !== 'undefined') { addToData(); };
			pathData.setAttribute('value', data.toString());
			console.log(data.toString());
			nextForm.submit();
		});			
	}

	// -------------------------------------------------------------
	var showNextButton = function(map, doc, data, destination, addToData) 
	// -------------------------------------------------------------
	{
		showButton(map, doc, data, destination, addToData, 'next-page');
	}

	// -------------------------------------------------------------
	var showPreviousButton = function(map, doc, data, destination, addToData) 
	// -------------------------------------------------------------
	{
		showButton(map, doc, data, destination, addToData, 'previous-page');
	}

	// -------------------------------------------------------------
	var showTimestampInfoWindow = function(position) 
	// -------------------------------------------------------------
	{
		var info = document.createElement('div');
		info.setAttribute('class', 'timestamp');
		info.innerHTML = '<form class="timestamp-form" onclick="false">'+
				'<label for="time">Time</label>'+
				'<br />'+
				'<input type="text" name="time" class="timestamp"/>'+
				// '<input type="hidden" name="position-lat" value="' + position.lat() + '"/>'+
				// '<input type="hidden" name="position-lng" value="' + position.lng() + '"/>'+
			'</form>'
		return info;
	}

	// --------------------------------------------------------------
	var showPlaceholderInfoWindow = function(position, time) 
	// --------------------------------------------------------------
	{
		var placeholder = document.createElement('div');
		placeholder.innerHTML = '<div class="timestamp-label" style="font-size: 14pt;">'+time+'</div>'+
			'<form class="placeholder-form">'+
				// '<input type="hidden" name="position-lat" value="' + position.lat() + '"/>'+
				// '<input type="hidden" name="position-lng" value="' + position.lng() + '"/>'+
			'</form>';
		return placeholder;
	}

	// Need to make sure that this works for both timestamp windows that are open AND closed
	// ---------------------------------------------------------------
	var getTimestamps = function(xs) 
	// ---------------------------------------------------------------
	{
		var timestamps = [];
		for(var i = 0; i < xs.length; i++) {
			var timestamp = xs[i];
			var time = timestamp.getContent().childNodes[0][0].value;
			var position = (function() { return { lat: timestamp.getPosition().lat(), lng: timestamp.getPosition().lng()}; })();
			timestamps.push({ time: time, position: position });
		}
		return timestamps;
	}

	// ---------------------------------------------------------------
	var getIcon = function()
	// ---------------------------------------------------------------
	{
		return {
			url: "../marker.png",
			anchor: new google.maps.Point(10,10)
		};
	}

	// ---------------------------------------------------------------
	var addTimestampMarker = function(map, polyline, position) 
	// ---------------------------------------------------------------
	{
		console.log(position);
		var infowindow = new InfoBox({
			content: showTimestampInfoWindow(position),
			position: position,
			boxStyle: {
				background: '#ffffff',
				opacity: 0.75,
				padding: '5px'
			}
		});

		// timestamps.push(infowindow);

		var label = infowindow.getContent().childNodes[0].childNodes[0];
		google.maps.event.addDomListener(label, 'click', function(event) {
			infowindow.setMap(null);
			// this code might not be very robust
			var time = infowindow.getContent().childNodes[0][0].value;
			var placeholder = new InfoBox({
				content: showPlaceholderInfoWindow(position, time),
				position: infowindow.getPosition(),
				boxStyle: {
					background: 'rgba(0,0,0,0)',
					'border-radius': '5px',
					padding: '5px'
				},
				closeBoxURL: ""
			});
			// console.log(placeholder.getContent().childNodes[1].childNodes[0].value);
			// console.log(placeholder.getContent().childNodes[0]);
			google.maps.event.addDomListener(placeholder.getContent(), 'click', function(event) {
				placeholder.setMap(null);
				infowindow.open(map);
			});
			var marker = new google.maps.Marker({
				icon: { url: "../marker.png", anchor: new google.maps.Point(10,10) },
				shape: { type: "rect", coords: [0,0,20,20] },
				position: infowindow.getPosition(),
				draggable: true,
				map: map
			});
			// restrict dragging to the polyline
			google.maps.event.addListener(marker, 'drag', function(event) {
				var dragPosition = mapcalc.closestPointOnPolyline(userPolyline, marker.getPosition(), 0.000001, map);
				marker.setPosition(dragPosition);
				placeholder.setPosition(dragPosition);
				google.maps.event.addListener(marker, 'dragend', function(event) {
					infowindow.setPosition(dragPosition);
					placeholder.setPosition(dragPosition);
				});			
			});
			google.maps.event.addListener(marker, 'click', function(event) {
				placeholder.setMap(null);
				marker.setMap(null);
				infowindow.open(map);
			});					
			placeholder.open(map);
		});

		infowindow.open(map);
		// console.log(closestPointOnPolyline(userPolyline, event.latLng, 0.00001, map));	

		return infowindow;
	}

	var instructions = (function() {
		var opt = {};
		opt.content = [];

		var setupInstructions = function(doc) {
			var extra = doc.getElementById('extra');
			extra.innerHTML = '<div id="welcome">'+
				'<div class="close-box">'+
					'<img src="../images/close-icon.png"/>'+
				'</div>'+				
				'<div id="welcome-content">'+
				'</div><!-- #welcome-content -->'+
				'<button id="next-instruction">Next</button>'+				
			  '</div><!-- #welcome -->';
		}
		var getInstructions = function(map, doc) {
			var instructions = doc.createElement('div');
			instructions.id = 'instructions';

			// initialize the instructions sidebar to be hidden
			instructions.style.display = 'none';
			conn2 = new XMLHttpRequest();
			conn2.open('GET', 'instructions.php', true);
			conn2.onreadystatechange = function() {
				if (this.readyState !== 4 ) return; 
				if (this.status !== 200 ) return; 
				instructions.innerHTML = this.responseText;				
			};
			conn2.send();
			map.controls[google.maps.ControlPosition.RIGHT_CENTER].push(instructions);	

		}
		var showWelcome = function(map, doc, drawingManager) {
			var welcome = doc.getElementById('welcome');
			var welcome_content = doc.getElementById('welcome-content');

			welcome.style.display = 'block';

			if (doc.getElementById('instructions') != null) { 			
				doc.getElementById('instructions').style.display = 'none';			
			}						

			// initialize welcome screen
		    var welcome_screen_index = 0;
		    var content = getContent();
		    welcome_content.innerHTML = content[welcome_screen_index];
		    google.maps.event.addDomListener(doc.getElementById('next-instruction'), 'click', function() {
				console.log(welcome_screen_index);
				if (welcome_screen_index < content.length - 1) { 
				    welcome_screen_index += 1;
				    welcome_content.innerHTML = content[welcome_screen_index]; 
				}
				else { startDrawing(map, doc, drawingManager); }
			});

		}
		var hideWelcome = function(doc) {
			doc.getElementById('welcome').style.display = 'none';
			google.maps.event.clearListeners(doc.getElementById('next-instruction'), 'click');

			doc.getElementById('instructions').style.display = 'block';
		}
		var startDrawing = function(map, doc, drawingManager, initDrawingManager) {
			hideWelcome(doc);		
			drawingManager.setMap(map);			

			google.maps.event.addDomListener(doc.getElementById('instructions-content'), 'click', function() {
				showWelcome(map, doc, drawingManager);
			});		

			google.maps.event.removeListener(initDrawingManager);				
		}
		var setContent = function(array) {
			opt.content = array;
		}	
		var getContent = function() {
			return opt.content;
		}
		var init = function(map, doc, drawingManager, options) {
			// initialize main instructions
			setupInstructions(doc);

			// initialize instructions sidebar
			getInstructions(map, doc);				
			// var welcome = doc.getElementById('welcome-content');

			if (typeof options !== 'undefined') {
				if (typeof options.content !== 'undefined') {
					setContent(options.content);
				}
				if (typeof options.visible !== 'undefined') {
					setVisible(options.visible);
				}
			}

			showWelcome(map, doc, drawingManager);	

			// event handler to close welcome screen
			var welcome_close = doc.getElementsByClassName('close-box')[0];
			google.maps.event.addDomListener(welcome_close, 'click', function() {
				startDrawing(map, doc, drawingManager, initDrawingManager);
			});	

			// if user clicks outside of welcome screen, then start drawing
			var initDrawingManager = google.maps.event.addListener(map, 'click', function() {
				startDrawing(map, doc, drawingManager, initDrawingManager);				
			});							
		}

		return {
			'init': init,
			'setContent': setContent,
			'getContent': getContent
		}
	}());

	String.prototype.capitalize = function() {
	    return this.charAt(0).toUpperCase() + this.slice(1);
	}

	// public methods and constructors
	return {
		personPath: personPath, 
		showNextButton: showNextButton,
		addTimestampMarker: addTimestampMarker,
		getTimestamps: getTimestamps,
		instructions: instructions
	};
}());

var mapcalc = (function() {

	var verbose = false;

	var latToLngScalingFactor = function() {
		var unitDistanceLat = google.maps.geometry.spherical.computeDistanceBetween(
			new google.maps.LatLng(41.690113, -87.600732),
			new google.maps.LatLng(41.890113, -87.600732)
		);

		var unitDistanceLng = google.maps.geometry.spherical.computeDistanceBetween(
			new google.maps.LatLng(41.790113, -87.500732),
			new google.maps.LatLng(41.790113, -87.700732)
		);
		return unitDistanceLat/unitDistanceLng;
	} ();

// Constructor for a Segment object.  Takes two LatLng points.
// -------------------------------------------
	var Segment = function(endpoint1, endpoint2) 
// -------------------------------------------
	{
		this.getVertices = function() {
			return [endpoint1, endpoint2];
		}
		this.generateSlope = function() {
			var dx = (latToLngScalingFactor^2)*(endpoint1.lat() - endpoint2.lat());
			var dy = endpoint1.lng() - endpoint2.lng();
			return dy/dx;
		};
		this.generatePerpendicularSlope = function() {
			return -1/this.generateSlope();
		};
		this.toLine = function() {
			return new Line(endpoint1, this.generateSlope());
		};
	}

// Constructor for a Line object.  Takes a LatLng point and a slope (a number).
// ------------------------------------------------------------
	var Line = function(point, slope) 
// ------------------------------------------------------------
	{
		this.getSlope = function () { return slope; };
		this.getPoint = function () { return point; };
		this.getPerpendicularSlope = function () { return -1/slope; };
		this.calculateIntersection = function(that) {
			// Assuming that the equations of the two lines are:
			//     this: y = y_0 + m_0(x - x_0)
			//     that: y = y_1 + m_1(x - x_1)

			var k = latToLngScalingFactor;
			var y_0 = point.lat();
			var y_1 = that.getPoint().lat();
			var m_0 = slope;
			var m_1 = that.getSlope();
			var x_0 = point.lng();
			var x_1 = that.getPoint().lng();

			var x_intersect = ((y_0 - y_1) - (m_0*x_0 - m_1*x_1))/(m_1 - m_0);

			return new google.maps.LatLng(
				y_0 + m_0*(x_intersect - x_0), x_intersect

			);
		};
	}

// Returns the ith segment of the polyline, indexed from 0 to n.
// -----------------------------------------------------------------------
	var getSegment = function(polyline, i) 
// -----------------------------------------------------------------------
	{
		if (polyline.getPath().getArray().length < i + 1)
			throw "Polyline has fewer than " + i + " segments.";
		else
			return new Segment(polyline[i], polyline[i+1]);
	}

// -----------------------------------------------------------------------
	var positionAlongPolyline = function(polyline, length) 
// -----------------------------------------------------------------------
	{
		var num = polyline.getPath().getArray().length;
		var cumulativeLength = 0;
		for (var i = 0; i < num - 1; i++) {
			if (cumulativeLength > length) {
				var nothing = 0;
				// return the position of a point that is length - (cumulativelength - google.maps.geometry.spherical.computeLength(getSegment(polyline, i-1))); 			}
			}
			else {
				cumulativeLength += google.maps.geometry.spherical.computeLength(getSegment(polyline, i));
			}
		}
	}

// ------------------------------------------------------------------------
	var getIterationsNumber = function(segment, point, dx, distanceUpperBound)
// ------------------------------------------------------------------------
	{
		var m = segment.generatePerpendicularSlope();
		var unitDistance = google.maps.geometry.spherical.computeDistanceBetween(
			point,
			new google.maps.LatLng(point.lat() + dx, point.lng() + latToLngScalingFactor*m*dx)
		);
		return distanceUpperBound/unitDistance;
	}

// -------------------------------------------------------------------------------
	var closestPerpendicularPoint = function(polyline, segment, point, dx, map) 
// -------------------------------------------------------------------------------
	{
		var segmentVerticesByDistance = segment.getVertices().map(function(p) { return {coord: p, point: point}; }).sort(comparePoints);
		var distanceUpperBound = google.maps.geometry.spherical.computeDistanceBetween(segmentVerticesByDistance[0].coord, point);


		var n = getIterationsNumber(segment, point, dx, distanceUpperBound);

		var line = new Line(point, segment.generatePerpendicularSlope());
		var m = line.getSlope();

		// var p = line.calculateIntersection(segment.toLine());
		// console.log("intersection at " + JSON.stringify(p));
		// placeMarker(p, map);
		// return p;


		for (i = 0; i < n; i++) {
			var testPoint = new google.maps.LatLng(point.lat() + i*dx, point.lng() + m*i*dx);
			if (verbose) { placeMarker(testPoint, map); };
			if (google.maps.geometry.poly.isLocationOnEdge(testPoint, polyline, dx))
				return testPoint;
		}
		for (i = 0; i > -n; i--) {
			var testPoint = new google.maps.LatLng(point.lat() + i*dx, point.lng() + m*i*dx);
			if (verbose) { placeMarker(testPoint, map); };
			if (google.maps.geometry.poly.isLocationOnEdge(testPoint, polyline, dx))
				return testPoint;
		}
		return point;
	}

// takes a LatLng point and an array of LatLng points
// -----------------------------------------------------------------------------
	var closestVertex = function(point, polyline) 
// -----------------------------------------------------------------------------
	{
		orderedCoordArray = new Array();
		for(i = 0; i < polyline.getPath().getArray().length; i++) {
			a = {coord: polyline.getPath().getAt(i) , index:i, point:point};
			orderedCoordArray.push(a);
		}
		orderedCoordArray.sort(comparePoints);
		return orderedCoordArray[0];
	}

// -----------------------------------------------------------------------------
	var comparePoints = function(a, b) 
// -----------------------------------------------------------------------------
	{
		if (google.maps.geometry.spherical.computeDistanceBetween(a.point, a.coord) < google.maps.geometry.spherical.computeDistanceBetween(b.point, b.coord)) 
			return -1;
		if (google.maps.geometry.spherical.computeDistanceBetween(b.point, b.coord) < google.maps.geometry.spherical.computeDistanceBetween(a.point, a.coord))
			return 1;
		else
			return 0;
	}

// ----------------------------------------------------------------------------
	var placeMarker = function(point, map) 
// ----------------------------------------------------------------------------
	{
		var marker = new google.maps.Marker({
			position: point,
			map: map
		});
	}

	var validDeleteUrl = false;

// ---------------------------------------------------------------
	var getDeleteUrl = function() 
// ---------------------------------------------------------------
	{
		var deleteUrl = 'http://i.imgur.com/RUrKV.png';
		if (!validDeleteUrl) {
			var request = new XMLHttpRequest();
			request.open('GET', deleteUrl, false);
			request.onreadystatechange = function() {
				if (request.readyState == 4) {
					if (request.status == 200) { validDeleteUrl = true; };
				}
			};
			request.send();
		}
		if (validDeleteUrl) { return deleteUrl;	}
		else throw "Link to delete vertex image is broken.";
	}

// ------------------------------------------------------------
	var closestPointOnPolyline = function(polyline, point, t, map) 
// ------------------------------------------------------------
	{
		var criticalPoints = new Array();
		var v = closestVertex(point, polyline);
		criticalPoints.push(v.coord);
		if (v.index > 0) {
			var segment1 = new Segment(polyline.getPath().getAt(v.index -1), v.coord);
			criticalPoints.push(closestPerpendicularPoint(polyline, segment1, point, t, map));
		}
		if (v.index < polyline.getPath().getArray().length - 1) {
			var segment2 = new Segment(v.coord, polyline.getPath().getAt(v.index + 1));
			criticalPoints.push(closestPerpendicularPoint(polyline, segment2, point, t, map));
		}

		var critical = criticalPoints.map(function(p) { return { coord:p, point: point }; }).sort(comparePoints);
		for (p = 0; p < critical.length; p++) {
			if (google.maps.geometry.poly.isLocationOnEdge(critical[p].coord, polyline, t))
				return critical[p].coord;
		}
		return -1;
	};

// --------------------------------------------------------------
	var getUndoButton = function(doc) 
// --------------------------------------------------------------
	{
		var images = doc.getElementsByTagName('img');
		for (var i = 0; i < images.length; i++) {
			console.log(images[i].src);
			if (images[i].src == 'https://maps.gstatic.com/mapfiles/undo_poly.png')
				return images[i];
		}
		return -1;
	};

// --------------------------------------------------------------
	var getDeleteButton = function(doc)
// --------------------------------------------------------------
	{
		var images = doc.getElementsByTagName('img');
		for (var i = 0; i < images.length; i++) {
			console.log(images[i].src);
			if (images[i].src == getDeleteUrl())
				return images[i];
		}
		return -1;
	};

// --------------------------------------------------------------
	var addDeleteButton = function(doc, polyline)
// --------------------------------------------------------------
	{
		var deleteButton = doc.createElement('div');
		deleteButton.setAttribute('style', 'overflow-x: hidden; overflow-y: hidden; position: absolute; width: 30px; height: 27px; top: -10px; left: 5px;');
		deleteButton.innerHTML = '<img src="' + getDeleteUrl() + '" class="deletePoly" style="height:auto; width:auto; position: absolute; left:0;"/>';
		google.maps.event.addDomListener(deleteButton, 'mouseover', function() {
			deleteButton.getElementsByTagName('img')[0].style.left = '-30px';
		});	
		google.maps.event.addDomListener(deleteButton, 'mouseout', function() {
			deleteButton.getElementsByTagName('img')[0].style.left = '0';
		});
		google.maps.event.addDomListener(deleteButton, 'mousedown', function() {
			deleteButton.getElementsByTagName('img')[0].style.left = '-60px';
		});	
		google.maps.event.addDomListener(deleteButton, 'mouseup', function() {
			deleteButton.getElementsByTagName('img')[0].style.left = '0';		
		});
		return deleteButton;

	};

// ----------------------------------------------------------------------
	var rightClickButton = function(map, doc, polyline)
// ----------------------------------------------------------------------
	{
		var deleteButton = addDeleteButton(doc, polyline);
		var rightClickDiv = new InfoBox({
			content: deleteButton,
			closeBoxURL: "",
			visible: false,
		});

		/* Need to define these methods (unfortunately) because
		 * 	1. InfoBox method isVisible() is not implemented (although documentation says it is)
		 * 	2. InfoBox attribute visible says whether the infobox is visible ON OPEN, not whether it is visible.`
		 */
		rightClickDiv.mapCalcVisibility = false;
		rightClickDiv.mapCalcShow = function() {
			rightClickDiv.show();
			rightClickDiv.mapCalcVisibility = true;
		}
		rightClickDiv.mapCalcHide = function() {
			rightClickDiv.hide();
			rightClickDiv.mapCalcVisibility = false;
		}
		rightClickDiv.mapCalcIsVisible = function() {
			return rightClickDiv.mapCalcVisibility;
		}

		google.maps.event.addListener(polyline, 'rightclick', function(point) {
			if (point.vertex != null) getUndoButton(doc).style.display = 'none';
		});	

		google.maps.event.addListener(polyline.getPath(), 'set_at', function(point) {
			if (!rightClickDiv.mapCalcIsVisible()) { getUndoButton(doc).style.display = 'block'; }
			else { getUndoButton(doc).style.display = 'none'; }
		});

		google.maps.event.addListener(polyline, 'rightclick', function(point) {
			if (point.vertex != null) {
				rightClickDiv.setPosition(point.latLng);
				rightClickDiv.mapCalcShow();
				rightClickDiv.open(map);		

				// Move the delete button if user drags its associated vertex.  Otherwise, hide it.
				var setAtListener = google.maps.event.addListener(polyline.getPath(), 'set_at', function(newpoint) {
					if (newpoint == point.vertex) 
						rightClickDiv.setPosition(polyline.getPath().getAt(newpoint));
					else {
						rightClickDiv.mapCalcHide();
					}
				});

				// This prevents the user from right-clicking many times in succession on the same
				// vertex and thereby deleting many more than one vertex.
				google.maps.event.clearListeners(deleteButton, 'click');

				google.maps.event.addDomListener(deleteButton, 'click', function(event) {
					polyline.getPath().removeAt(point.vertex);
					rightClickDiv.mapCalcHide();
				});
				google.maps.event.addDomListener(map, 'click', function() {
					rightClickDiv.mapCalcHide();
					/* If we don't clear the listener here, this is what happens:
					 *	 listener gets registered on vertex N
					 *	 vertex N is deleted
					 *	 listener still deletes vertex N on rightclick, but the number N now refers to a different vertex
					 */
					google.maps.event.clearListeners(deleteButton, 'click');
					google.maps.event.removeListener(setAtListener);
				});
			}
		});	
		return rightClickDiv;
	};

	// public methods and constructors
	return {
		'closestPointOnPolyline': closestPointOnPolyline, 
		'rightClickButton': rightClickButton,
		'placeMarker': placeMarker
	}

}());

// --------------------------------------------------------------
	var dx = function() 
// --------------------------------------------------------------
	{

	}

// ---------------------------------------------------------------------
	Math.sinh = function(x) 
// ---------------------------------------------------------------------
	{
		return 0.5*(Math.exp(x) - Math.exp(-x));
	}

// ---------------------------------------------------------------------
	Math.cosh = function(x) 
// ---------------------------------------------------------------------
	{
		return 0.5*	(Math.exp(x) + Math.exp(-x));
	}

// ---------------------------------------------------------------------
	Math.tanh = function(x) 
// ---------------------------------------------------------------------
	{
		return Math.sinh(x)/Math.cosh(x);
	}

// ---------------------------------------------------------------------
	Math.atanh = function(x) 
// ---------------------------------------------------------------------
	{
		return 0.5*Math.log((1+x)/(1-x));
	}

// ---------------------------------------------------------------------
	var bearing = function(point1, point2) 
// ---------------------------------------------------------------------
	{
		var top = Math.atanh(Math.sin(point2.lat()));
		var bottom = point2.lng() - equatorialIntercept(point1, point2);
		return top/bottom;
	}

// ---------------------------------------------------------------------
	var equatorialIntercept = function(point1, point2)
// ---------------------------------------------------------------------
	{
		var y1 = Math.atanh(Math.sin(point1.lat()));
		var y2 = Math.atanh(Math.sin(point2.lat()));
		var top = y2*point1.lng() - y1*point2.lng();
		var bottom = y2 - y1;
		return top/bottom;
	}

// ---------------------------------------------------------------------
	var rhumbLineLatitude = function(point1, point2)
// ---------------------------------------------------------------------
{
	var azimuth = bearing(point1, point2);
	var lambda = equatorialIntercept(point1, point2)
	return Math.asin(Math.tanh(azimuth*(point1.lng() - lambda)));
}

var test = function(point1, point2, map) {
	if (point1.lng() > point2.lng()) {
		var delta = 0.000001;
		var p = new google.maps.LatLng(rhumbLineLatitude(point2, point1), point2.lng() + delta);
		console.log(p);
		console.log('bearing: ' + bearing(point1, point2));
		console.log('equatorialIntercept: ' + equatorialIntercept(point1, point2));
		mapcalc.placeMarker(new google.maps.LatLng(0, equatorialIntercept(point1, point2)), map);
		mapcalc.placeMarker(p, map);
	}
	
}


