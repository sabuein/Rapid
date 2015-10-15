/*

Copyright (C) 2014 - Gareth Edwards / Rapid Information Systems

gareth.edwards@rapid-is.co.uk


This file is part of the Rapid Application Platform

RapidSOA is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version. The terms require you to include
the original copyright, and the license notice in all redistributions.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
in a file named "COPYING".  If not, see <http://www.gnu.org/licenses/>.

*/

/*

This is the core of the designer

Some terms:

Control - this refers to a control the user can add to a page, and is fairly high order, each control has a *.control.xml file in the controls directory that defines its behaviour

Object - this refers to the JQuery object made from the html

Geometry - the pixel space an object takes up 
 
*/

// details of all available action types
var _actionTypes = {};
// details of all available control types;
var _controlTypes = {};
// the option values with all available actions for adding to selects
var _actionOptions = "";
// details of all the available apps
var _apps = [];
// details of all the available application versions
var _versions = [];
// the version we are designing
var _version = {};
// the page of the app we are designing
var _page = {};
// a list of available pages
var _pages = [];
// a list of available actions
var _actions = [];
// a list of available style classes
var _styleClasses = [];

// the document window
var _window;
// the iframe that contains the page we are working on
var _pageIframe;
// the iframe window
var _pageIframeWindow;
// the div that covers all of the components in design mode so they don't react to clicks
var _designCover;
// track whether the mouse is up or down
var _mouseDown = false;
// track mouseDown offsets
var _mouseDownXOffset = 0;
var _mouseDownYOffset = 0;
//  an object to hold the user-specified sizes of panels and dialogues
var _sizes = {};
// track whether we've moused down on the control panel resize
var _controlPanelSize = false;
// track whether we've moused down on the properties panel resize
var _propertiesPanelSize = false;
// track whether we've moused down on the dialogue resize
var _dialogueSize = false;
// the dialogue's id
var _dialogueSizeId;
// the resize type
var _dialogueSizeType;
// track whether we've added a control
var _addedControl = false;
// track whether we are currently moving a control
var _movingControl = false;
// we need to retain the control we have moved over
var _movedoverControl = null;
// we need to retain whether we are on the left or right so we insert before or after
var _movedoverDirection = "";
// we need to retain any controls we've moused over so we can fire mouse out
var _mousedOverControl = null;
// we need to retain whether the page order has been changed (no need to send and reprocess if not)
var _pageOrderChanged = false;
//we need to retain whether the page order has been reset too (this puts it back in alphabetical mode)
var _pageOrderReset = false;

// retain the currenty selected object
var _selectedControl = null;
// the div which we use a border around the selected object
var _selectionBorder;
// the div which we cover the selected object with whilst we are moving it around
var _selectionCover;
// the div which we place to show where an insert/move to the right would occur
var _selectionMoveLeft;
//the div which we place to show where an insert/move to the left would occur
var _selectionMoveRight;
// the div which we place to show where an insert would occur
var _selectionInsert;
// a div that we cover the parent object with to show it's full extent
var _selectionInsertCover;


// whether the left control panel is pinned
var _panelPinned = true;
// panel offset if pinned (includes padding and border)
var _panelPinnedOffset = 221;
// whether styles are hidden
var _stylesHidden = false;
// whether style classes are hidden
var _styleClassesHidden = false;

// scroll bar width
var _scrollBarWidth = 0;

// retain the copied control
var _copyControl;
// retain the copied action(s)
var _copyAction;
// undo stack
var _undo = [];
// redo stack
var _redo = [];
// whether there are unsaved changes
var _dirty;
// whether this page is locked for editing by another user
var _locked = false;

// the next control id
var _nextId = 1;
// the next page id
var _nextPageId = 1;

// a map of all former control and action id's and the new ones they get in the paste
var _pasteMap = {};

// a global object for the different devices we are supporting, typically for mobiles
var _devices = [{name:"Desktop", width: 0, height: 0, ppi: 96, scale: 1 }];
// a global for the ppi of the device we've loaded the designer in
var _ppi = 96;
// a global for the selected device index
var _device = 0;
// the zoom factor at which we want to see the device screen
var _zoom = 1;
// the orientation we want to see the device screen
var _orientation = "P";
// the difference in resolution between screen and device * zoom
var _scale = 1;
// the scale * zoom
var _mouseScale;

// takes a snapshot of the current page and adds it to the undo stack
function addUndo(usePage, keepRedo) {	
	
	// must have a selected control or page
	if (_selectedControl || usePage) {	
		
		// set dirty
		_dirty = true;		
		
		// the undo control
		var undoControl = null;
		
		// stringify either selected or whole page
		if (usePage) {
			// snapshot the whole page
			undoControl = JSON.stringify(getDataObject(_page));			
		} else {
			// retain childControls
			var childControls = _selectedControl.childControls;
			// remove them temporarily
			_selectedControl.childControls = null;
			// stringify the selected control
			undoControl = JSON.stringify(getDataObject(_selectedControl));
			// add back the child controls
			_selectedControl.childControls = childControls;
		}
		
		// if the control is different from the last item on the undo stack push it on
		if (_undo.length == 0 || (_undo.length > 0 && undoControl != _undo[_undo.length - 1])) _undo.push(undoControl);
		
		// remove an item from the bottom of the stack if it's too big
		if (_undo.length > 50) _undo.splice(0, 1);
		
		// enable undo button
		$("#undo").enable();
		
		// undo snapshots from the undo button create a redo snap shotshot if the snapshot request comes from elsewhere remove redo
		if (!keepRedo && _redo.length > 0) {
			// empty the redo stack
			_redo = [];
			// disable the redo button
			$("#redo").disable();
		} // keep redo
		
	} // control check
}

// used by both undo and redo to apply their snapshot
function applyUndoRedo(snapshot) {
	
	// check we were passed something to re-apply
	if (snapshot) {		
		
		// parse the snapshot
		var undoredoControl = JSON.parse(snapshot);
		
		// hide the selection border
		$("#selectionBorder").hide();
		// remove any dialogues or components
		$("#dialogues").children().remove();
		
		// find the control we are applying the undo to
		var applyControl = getControlById(undoredoControl.id);
		// make sure we got one
		if (applyControl) {
				
			// retain the selected control id
			var selectedControlId = null;
			// if we have a selected control
			if (_selectedControl) {
				// get it's the id
				selectedControlId = _selectedControl.id;
				// lose the current selected object
				_selectedControl = null;
			}						
			// lose the property control
			_propertiesControl = null;
			
			// retain reference to the object we are applying
			var applyObject = applyControl.object;			
			
			// if we're apply a page snapshot
			if (undoredoControl.type == "page") {
				
				// retain reference to page object
				var pageObject = _page.object;
								
				// if it's the whole page
				if (undoredoControl.childControls) {
					
					// retain a reference to the child controls
					var childControls = undoredoControl.childControls;
					
					// remove the children from the undoredo object
					delete undoredoControl.childControls;
					
					// remove all current page html
					pageObject.children().remove();
					
					// remove all non-visible controls
					$("img.nonVisibleControl").remove();
													
					// load the page object from the undo snapshot
					_page = new Control("page", null, undoredoControl, true, false, true);
					
					// put the page object back
					_page.object = pageObject;
					
					// we're re-doing the whole page so reset the next control id and control numbers 
					_nextId = 1;
					_controlNumbers = {};
					
					// loop the retained childControls and create
			    	for (var i = 0; i < childControls.length; i++) {
			    		// get an instance of the control properties (which is what we really need from the JSON)
			    		var childControl = childControls[i];
			    		// create and add
			    		_page.childControls.push(loadControl(childControl, _page, true, false, true));
			    	}
			    	
			    	// arrange any non-visible controls
			    	arrangeNonVisibleControls();
										
				} else {
					
					// retain a reference to the child controls
					var childControls = _page.childControls;
					
					// load the page object from the undo snapshot
					_page = new Control("page", null, undoredoControl, true, false, true);
					
					// put the page object back
					_page.object = pageObject;     	
									
					// put the child controls back
					_page.childControls = childControls;
					
				}
																															
			} else {
				
				// remove the object this snapshot is being applied to
				applyObject.remove();
				
				// loop the parent child controls
				for (var i in applyControl._parent.childControls) {
					// get a reference to the applychild
					var applyChildControl = applyControl._parent.childControls[i];
					// check if it's the one to replace
					if (applyChildControl.id == undoredoControl.id) {
						// copy in the child controls
						undoredoControl.childControls = applyChildControl.childControls;
						// update this child control
						applyControl._parent.childControls[i] = loadControl(undoredoControl, applyControl._parent, true, false, true);						
						// we're done
						break;
					}
				}
												
			}
									
			// if there was a control selected
			if (selectedControlId) {
				// re-select the initial control
				_selectedControl = getControlById(selectedControlId);
				// rebuild any properties
				selectControl(_selectedControl);
				// re apply any styles (this will call window resize)
				rebuildStyles();
			}
			
		} // apply control check
		
	} // undo snapshot check
	
}

// takes the most recent snapshot off the top of the undo stack and applies it
function doUndo() {
	// retrieve the last page from the top of the undo stack
	var undoSnapshot = _undo.pop();
	// if there was one
	if (undoSnapshot) {		
		// grab the page snapshot
		var pageSnapshot = JSON.stringify(getDataObject(_page));
		// only called in doUndo so less checking
		_redo.push(pageSnapshot);
		// enable undo button
		$("#redo").enable();
		// apply the undo
		applyUndoRedo(undoSnapshot);				
	}
	// if there's nothing more on the stack
	if (_undo.length == 0) {
		// disable undo button
		$("#undo").disable();
		// page can't be dirty either
		_dirty = false;
	}
}

// takes the most recent snapshot off the top of the redo stack and applies it
function doRedo() {
	// retrieve the last page from the top of the redo stack
	var redoSnapshot = _redo.pop();
	// if there was one
	if (redoSnapshot) {
		// add an undo snapshot for the whole page, just before we redo with the keep redo set to true
		addUndo(true, true);
		// apply the redo
		applyUndoRedo(redoSnapshot);		
	}
	// disable redo button if there's nothing more on the stack
	if (_redo.length == 0) $("#redo").disable();
}

// if the page is dirty prompt the user that they will lose unsaved changes
function checkDirty() {
	if (_dirty) {
		return confirm("You will lose your unsaved changes. Are you sure?");
	} else {
		return true;
	}
}

// this function returns a control's height after taking into account floating children
function getControlHeight(control, childLevel) {
	// if there is no childLevel set it to 0
	if (!childLevel) childLevel = 0;
	// get the object
	var o = control.object;
	// assume height is straightforwards (includes border but not margin)
	var height = o.outerHeight();	
	// assume child height = zero
	var childHeight = 0;
	// if we are below the max child levels (the recursion can get quite fierce)
	if (childLevel <= 3) {
		// increment the child level
		childLevel ++;
		// loop all children and sum their height
		for (var i in control.childControls) childHeight += getControlHeight(control.childControls[i], childLevel);
		// if the height is zero but there are child controls check further
		if (height < childHeight) {
			// assume no children are floating
			var floatLeftHeight = 0;
			var floatRightHeight = 0;
			// assume children are 0 left
			var left = 0;
			
			// loop the child controls looking for floating objects
			for (var i in control.childControls) {
				// get the child control
				var c = control.childControls[i];
				// get the child control position
				var cpos = c.object.position();
				// if this is the first child update the left
				if (i == 0) left = cpos.left;
				// check for a left float the same amount left as the parent
				if (c.object.css("float") == "left" && cpos.left == left) {
					floatLeftHeight += c.object.outerHeight() + toPixels(c.object.css("margin-top")) + toPixels(c.object.css("margin-bottom"));
				}
				// check for a right float the same amount right as the parent
				if (c.object.css("float") == "right" && cpos.left == left) {
					floatRightHeight += c.object.outerHeight() + toPixels(c.object.css("margin-top")) + toPixels(c.object.css("margin-bottom"));
				}
			}
			
			// if all heights are still zero and there are child controls
			if (height + floatLeftHeight + floatRightHeight == 0 && control.childControls.length > 0) {
				// set height to the first child control
				height = getControlHeight(control.childControls[0], childLevel);
			}
			// take the greatest of these 3 heights
			height = Math.max(height, o.outerHeight(), floatLeftHeight, floatRightHeight);
		} 
	}	
	height += getFloatHeight(control);
	// return it
	return height;

}
  
// controls that are preceeded by floating ones are actually lower then offset().top reports we want to add the heights  
function getFloatHeight(control, parentLevel) {
	var height = 0;
	if (!parentLevel) parentLevel = 0;
	var index = control.object.index();
	if (!control.object.is(".nonVisibleControl") && control._parent && parentLevel < 2) {
		parentLevel ++;
		if (index == 0) height += getFloatHeight(control._parent,parentLevel);
		var floatLeftHeight = 0;
		var floatRightHeight = 0;
		if (index > 0 && control._parent.childControls && index <  control._parent.childControls.length) {						
			var o = control._parent.childControls[index-1].object;
			// check for a left float the same amount left as the parent
			if (o.css("float") == "left") {
				floatLeftHeight += o.height() + toPixels(o.css("margin-top")) + toPixels(o.css("margin-bottom"));
			}
			// check for a right float the same amount right as the parent
			if (o.css("float") == "right") {
				floatRightHeight += o.height() + toPixels(o.css("margin-top")) + toPixels(o.css("margin-bottom"));
			}			
		}
		height = Math.max(height,floatLeftHeight, floatRightHeight);
	}
	return height;
}
 
// this function is useful for calling from the JavaScript terminal to find out why certain objects have not been found
function debuggMouseControl(ev, childControls) {	
	
	// get the mouse X and Y, relative to what's visible in the iframe
	var mouseX = ev.pageX + _pageIframeWindow.scrollLeft() - _panelPinnedOffset;
	var mouseY = ev.pageY + _pageIframeWindow.scrollTop();
	
	//console.log("X: " + mouseX + ", Y: " + mouseY);
	
	for (var i in childControls) {
		var o = childControls[i].object;
		var width = o.outerWidth() * _scale;
		var height = o.outerHeight() * _scale;
		console.log("id = " + o.attr("id") + " x1: " + o.offset().left + ", x2: " + (o.offset().left + width) + ", y1: " + o.offset().top + ", y2: " + (o.offset().top + height));
	}	
}

// this function finds the lowest control in the tree who's object encloses the ev.pageX and ev.pageY 
function getMouseControl(ev, childControls) {
			
	// only if the mouse is down
	if (_mouseDown) {
		
		// get the mouse X and Y, relative to what's visible in the iframe
		var mouseX = ev.pageX + _pageIframeWindow.scrollLeft() - _panelPinnedOffset;
		var mouseY = ev.pageY + _pageIframeWindow.scrollTop();
				
		//console.log("X: " + mouseX + ", Y: " + mouseY);
												
		// check if we hit the border first		
		var o = $("#selectionBorder");				
		// if we didn't find a control but the selection border is visible, return the current control
		if (o.is(":visible") && !_movingControl) {						
			// did we click on the border (it's position already has the pinned panel taken into account so no need to offset)
			if (ev.pageX >= o.offset().left && ev.pageY >= o.offset().top && ev.pageX <= o.offset().left + o.outerWidth() && ev.pageY <= o.offset().top + o.outerHeight()) {				
				// get the height of the object
				var height = getControlHeight(_selectedControl) * _scale;
				// grab the selected object
				o = _selectedControl.object;
				// get the width
				var width = o.outerWidth() * _scale;
				// if we clicked in the object space we skip this section and process the event thoroughly
				if (!(mouseX >= o.offset().left && mouseY >= o.offset().top && mouseX <= o.offset().left + width && mouseY <= o.offset().top + height)) {					
					// return the selected control
					return _selectedControl;
				}
			}
		}
		
		// we use this function recursively so start at the page if no array specified
		if (childControls == null) childControls = _page.childControls;
		
		// don't be tempted to sort the controls unless it's done very carefully as the object/control order can get out of sync and objects will move on saves and undos
		
		// loop all of our objects for non-visual controls
		for (var i in childControls) {
			// get a reference to this control
			var c = childControls[i];
			// get a reference to this object
			var o = c.object;
			// only if this object is non-visual
			if (o.is(".nonVisibleControl")) {
				// is the mouse below this object
				if (ev.pageX >= o.offset().left && ev.pageY >= o.offset().top) {
					// get the height of the object
					var height = o.outerHeight();
					// does the width and height of this object mean we are inside it
					if  (ev.pageX <= o.offset().left + o.outerWidth() && ev.pageY <= o.offset().top + height) {
						// return this non-visual control
						return c;
					}
				}
			}
		}
												
		// loop all of our objects 
		for (var i in childControls) {
			// get a reference to this control
			var c = childControls[i];
			// get a reference to this object
			var o = c.object;
			// only if this object is visible
			if (o.is(":visible")) {
				// get the top
				var top = o.offset().top;
				// is the mouse below this object
				if (mouseX >= o.offset().left && mouseY >= top) {
					// get the height of the object
					var height = getControlHeight(c) * _scale;				
					// get the width
					var width = o.outerWidth() * _scale;
					// does the width and height of this object mean we are inside it
					if  (mouseX <= o.offset().left + width && mouseY <= top + height) {
						// if there are childObjects check for a hit on one of them
						if (c.childControls) {
							// use this function recursively
							var childControl = getMouseControl(ev, c.childControls);
							// if we got a hit on a child object
							if (childControl) {
								// if the childControl is a table row we need to make sure that any cell or row spans are not interfering, there is a lot overhead but
								if (childControl.object.is("tr")) {
									// get the table
									var t = childControl._parent;
									// loop all of the rows
									for (var i in t.childControls) {
										// get a reference to the row
										var row = t.childControls[i];
										// only if this row is not the one already returned to us
										if (row.id != childControl.id) {
											// assume we couldn't find a cell control
											var cellControl = null;
											// loop all of the cells
											for (var j in row.childControls) {
												// get the cell
												var cell = t.childControls[i].childControls[j];
												// if the cell has a col or row span
												if (cell.colSpan > 1 || cell.rowSpan > 1) {
													// look for a hit in this row
													cellControl = getMouseControl(ev, row.childControls);
													// if we got one 
													if (cellControl) {
														// retain as childControl
														childControl = cellControl;
														// bail from the cell loop
														break;
													}
												}
											}
											// bail from the row loop if we got something ealier
											if (cellControl) break;
										} // different row check										
									} // table row loop
								} // row check
								// retain the child control
								c = childControl;
							}
						}							
						// return the control!
						return c;
					} // mouse within
				} // mouse below
			} // visible
		} // control loop
				
	}
}

// before controls are positioned their parent's are removed as they could be placed anywhere in tree
function removeControlFromParent(control) {
	// loop all of our objects
	for (var i in control._parent.childControls) {
		// get a reference to this control
		var c = control._parent.childControls[i];
		// do we have a hit on this object?
		if (c === control) {
			// remove that object
			control._parent.childControls.splice(i,1);
			// set the parent to null
			control._parent = null;
			// bail
			break;
		}
	}
}

// this sizes a border around the geometry of a control (it must be visible at the time, however briefly)
function sizeBorder(control) {
	// get the height of the control's object
	var height = getControlHeight(control);
	// get the width
	var width = control.object.outerWidth();
	// check if nonVisualControl
	if (control.object.is(".nonVisibleControl")) {
		width += 1;
		height += 1;
		_selectionBorder.css("z-index","10010");
	} else {
		width = width * _scale + 2;
		height = height * _scale + 2;
		_selectionBorder.css("z-index","10004");
	}
	// if the width is greater than the screen reduce by width of border
	if (width > _window.width() - _panelPinnedOffset - _scrollBarWidth) width -= 8;
	// size the selection border
	_selectionBorder.css({
		"width": width, // an extra pixel either side
		"height": height, // an extra pixel either side
		"margin-right": -width, // with overflow stop additional horizontal scroll bars
		"margin-bottom": - height // with overflow stop additional vertical scroll bars
	});
	// get the control class
	var controlClass = _controlTypes[control.type];
	// remove all move classes
	_selectionBorder.removeClass("selectionBorderMove");
	_selectionBorder.removeClass("selectionBorderNoMove");
	_selectionBorder.removeClass("selectionBorderInnerMove");
	_selectionBorder.removeClass("selectionBorderNoInnerMove");
	_selectionBorder.children().removeClass("selectionBorderInnerMove");	
	_selectionBorder.children().removeClass("selectionBorderNoInnerMove");
		
	// set the css according to move / no move
	if (controlClass) {
		// move / no move dotted/fixed border
		if (controlClass.canUserMove) {
			_selectionBorder.addClass("selectionBorderMove");
			_selectionBorder.children().addClass("selectionBorderInnerMove");	
			if (control.childControls.length == 0) {
				_selectionBorder.addClass("selectionBorderInnerMove");		
			} else {
				_selectionBorder.addClass("selectionBorderNoInnerMove");	
			}
		} else {
			_selectionBorder.addClass("selectionBorderNoMove");		
			_selectionBorder.children().addClass("selectionBorderNoInnerMove");
		}
		// set absolute/fixed
		if (controlClass.getHtmlFunction.indexOf("nonVisibleControl") > 0) {
			_selectionBorder.css("position","fixed");
		} else {
			_selectionBorder.css("position","absolute");
		}
	
	}

}

// this positions the selection border inclduing the mouseDown Offsets which should be zero when the mouse is not moving
function positionBorder(x, y) {
	// check we got something
	if (x != null) {
		// if x is actually a control
		if (typeof x === "object" && x.object) {
			// get the top
			var top = x.object.offset().top;
			// check if nonVisualControl
			if (x.object.is(".nonVisibleControl")) {
				positionBorder(
					x.object.offset().left - _window.scrollLeft(), 
					top - _window.scrollTop()
				);
			} else {
				positionBorder(
					x.object.offset().left - _pageIframeWindow.scrollLeft() + _panelPinnedOffset, 
					top - _pageIframeWindow.scrollTop()
				);
			}	
		} else {			
			// position the selection border
			_selectionBorder.css({
				left: x + _mouseDownXOffset - 8, // 8 = padding + border + 1 pixel	
				top: y + _mouseDownYOffset - 8 // 8 = padding + border + 1 pixel
			});				
		}
	}
}

// this uses both the above functions for a specific control
function positionAndSizeBorder(control) {
	// check we were given a control
	if (control) {
		// position border
		positionBorder(control);
		// size the border in case moving it has changed it's geometery
		sizeBorder(control);
	}
}

// this function returns a flat array of all of the page controls
function getControls(childControls, controls) {
	if (!childControls) childControls = _page.childControls;
	if (!controls) controls = [];
	for (var i in childControls) {
		var c = childControls[i];
		controls.push(c);
		getControls(c.childControls,controls);
	}	
	return controls;
}

// this function returns a set of options for a dropdown using the current set of pages
function getPageOptions(selectId, ignoreId) {
	var options = "";
	for (var i in _pages) {
		var page = _pages[i];
		if (page.id != ignoreId) options += "<option value='" + page.id + "' " + (page.id == selectId ? "selected='selected'" : "") + ">" + page.name + " - "  +page.title + "</option>"; 
	}
	return options;
}

// this function returns a set of options for a dropdown of controls
function getControlOptions(selectId, ignoreId, type) {
	var controls = getControls();
	var options = "";
	for (var i in controls) {
		var control = controls[i];
		// note how only control with names are included, and type is only matched if included
		if (control.id != ignoreId && control.name && (!type || type == control.type)) options += "<option value='" + control.id + "' " + (control.id == selectId ? "selected='selected'" : "") + ">" + control.name + "</option>"; 
	}
	return options;
}

//this function returns a set of options for a dropdown of security roles
function getRolesOptions(selectRole, ignoreRoles) {
	var options = "";
	var roles = _version.roles;
	if (roles) {		
		for (var i in roles) {
			// retrieve this role			
			var role = roles[i];
			// assume we're not going to ignore it
			var ignore = false;
			// loop ignore roles
			if (ignoreRoles) {
				for (var j in ignoreRoles) {
					if (role == ignoreRoles[j]) {
						ignore = true;
						break;
					}
				}
			}			
			// if we're not going to ignore it
			if (!ignore) options += "<option " + (role == selectRole ? "selected='selected'" : "") + ">" + role + "</option>"; 
		}
	}
	return options;
}

// different system properties for inputs
var _systemValues = ["app id","app version","page id","user name","online","mobile","mobile version","true","false","null","field"];

// this function returns a set of options for a dropdown for inputs or outputs (depending on input true/false), can be controls, control properties (input only), other page controls, page variables (input only), system values (input only)
function getDataOptions(selectId, ignoreId, input) {
	var options = "";	
	var controls = getControls();
	var gotSelected = false;
	if (controls) {
		options += "<optgroup label='Page controls'>";
		for (var i in controls) {	
			// retrieve the control
			var control = controls[i];
			// get the control class
			var controlClass = _controlTypes[control.type];
			// if we're not ignoring the control and it has a name
			if (controlClass && control.id != ignoreId && control.name) {
				
				// if it has a get data function (for input), or a setDataJavaScript
				if ((input && controlClass.getDataFunction) || (!input && controlClass.setDataJavaScript)) {
					if (control.id == selectId && !gotSelected) {
						options += "<option value='" + control.id + "' selected='selected'>" + control.name + "</option>";
						gotSelected = true;
					} else {
						options += "<option value='" + control.id + "' >" + control.name + "</option>";
					}				
				}
				
				// get any run time properties
				var properties = controlClass.runtimeProperties;
				// if there are runtimeProperties in the class
				if (properties) {
					// promote if array
					if ($.isArray(properties.runtimeProperty)) properties = properties.runtimeProperty;
					// loop them
					for (var i in properties) {
						// get the property
						var property = properties[i];
						// if we want inputs and there's is a get function, or outputs and there's set javascript
						if ((input && property.getPropertyFunction) || (!input && property.setPropertyJavaScript)) {
							// derive the key
							var key = control.id + "." + property.type;
							// add the option
							options += "<option value='" + key  +  "' " + (key == selectId ? "selected='selected'" : "") + ">" + control.name + "." + property.name + "</option>";
						}
						
					}
					
				}
								
			}												
			
		}
		options += "</optgroup>";
	}
	
	// page variables are for input only
	if (input && _page && _page.sessionVariables) {
		options += "<optgroup label='Page variables'>";
		for (var i in _page.sessionVariables) {
			if (selectId == _page.sessionVariables[i] && !gotSelected) {
				options += "<option value='" + _page.sessionVariables[i] + "' selected='selected' >" + _page.sessionVariables[i] + "</option>";
				gotSelected = true;
			} else {
				options += "<option value='" + _page.sessionVariables[i] + "' >" + _page.sessionVariables[i] + "</option>";
			}			
		}
		options += "</optgroup>";
	}
	
	// other page controls can be used for input
	if (_page && _pages) {

		for (var i in _pages) {
			
			if (_pages[i].id != _page.id && _pages[i].controls) {
				
				var pageControlOptions = "";
												
				for (var j in _pages[i].controls) {
					
					var control = _pages[i].controls[j];
					
					if (control.otherPages) {
											
						if ((input && control.input) || (!input && control.output)) {
							if (selectId == control.id && !gotSelected) {
								pageControlOptions += "<option value='" + control.id + "' selected='selected' >" +  control.name + "</option>";
								gotSelected = true;
							} else {
								pageControlOptions += "<option value='" + control.id + "' >" + control.name + "</option>";
							}
						}
						
						if (control.runtimeProperties) {						
							for (var k in control.runtimeProperties) {
								if ((input && control.runtimeProperties[k].input) || (!input && control.runtimeProperties[k].output)) {
									if (selectId == control.id + "." + control.runtimeProperties[k].type && !gotSelected) {
										pageControlOptions += "<option value='" + control.id + "." + control.runtimeProperties[k].type + "' selected='selected' >" + control.name + "." + control.runtimeProperties[k].name + "</option>";
									} else {
										pageControlOptions += "<option value='" + control.id + "." + control.runtimeProperties[k].type + "' >" + control.name + "." + control.runtimeProperties[k].name + "</option>";
									}	
								}
							}						
						}
					}					
				}
				
				if (pageControlOptions) options += "<optgroup label='" + _pages[i].name + " - " + _pages[i].title + "'>" + pageControlOptions + "</optgroup>";
			
			}			
		}
	}
	
	// system values, only for inputs - these are defined in an array above this function
	if (input && _systemValues) {
		options += "<optgroup label='System values'>";
		for (var i in _systemValues) {
			var val = "System." + _systemValues[i];
			options += "<option value='" + val + "'" + (val == selectId ? " selected='selected'" : "") + ">" + _systemValues[i] + "</option>";
		}
		options += "</optgroup>";
	}
	return options;
}

// this function returns a set of options for a dropdown of sessionVariables and controls with a getData method
function getInputOptions(selectId, ignoreId) {
	return getDataOptions(selectId, ignoreId, true);
}

// this function returns a set of options for a dropdown of sessionVariables and controls with a setData method
function getOutputOptions(selectId, ignoreId) {
	return getDataOptions(selectId, ignoreId, false);
}

// this function returns a set of options for use in page visibility logic
function getPageVisibilityOptions(selectId) {
	// we want this pages session variables and all prior pages session variables and controls with canBeUsedForFormPageVisibilty
	var options = "";
	var gotSelected = false;
	// page variables 
	if (_page && _page.sessionVariables) {
		options += "<optgroup label='Page variables'>";
		for (var i in _page.sessionVariables) {
			var val = "Session." + _page.sessionVariables[i];
			if (selectId == val && !gotSelected) {
				options += "<option value='" + val + "' selected='selected' >" + _page.sessionVariables[i] + "</option>";
				gotSelected = true;
			} else {
				options += "<option value='" + val + "' >" + _page.sessionVariables[i] + "</option>";
			}			
		}
		options += "</optgroup>";
	}
	// other pages
	if (_page && _pages) {
		// loop the pages
		for (var i in _pages) {
			// stop when the current page is reached (we only want the prior ones)
			if (_pages[i].id == _page.id) break;
			if (_pages[i].controls) {
				var pageControlOptions = "";
				// page session variables
				for (var j in _pages[i].sessionVariables) {
					var val = "Session." + _pages[i].sessionVariables[j];
					if (selectId == val) {
						pageControlOptions += "<option value='" + val + "' selected='selected' >" +  _pages[i].sessionVariables[j] + "</option>";
						gotSelected = true;
					} else {
						pageControlOptions += "<option value='" + val + "' >" + _pages[i].sessionVariables[j] + "</option>";						
					}
				}
				// page controls
				for (var j in _pages[i].controls) {					
					var control = _pages[i].controls[j];					
					if (control.pageVisibility) {																	
						if (selectId == control.id && !gotSelected) {
							pageControlOptions += "<option value='" + control.id + "' selected='selected' >" +  control.name + "</option>";
							gotSelected = true;
						} else {
							pageControlOptions += "<option value='" + control.id + "' >" + control.name + "</option>";
						}												
					}					
				}				
				if (pageControlOptions) options += "<optgroup label='" + _pages[i].name + " - " + _pages[i].title + "'>" + pageControlOptions + "</optgroup>";			
			}			
		}
	}
	// system values
	if (_systemValues) {
		options += "<optgroup label='System values'>";
		for (var i in _systemValues) {
			var val = "System." + _systemValues[i];
			options += "<option value='" + val + "'" + (val == selectId ? " selected='selected'" : "") + ">" + _systemValues[i] + "</option>";
		}
		options += "</optgroup>";
	}
	return options;
}

// this function returns a set of options for a dropdown of existing events from current controls 
function getEventOptions(selectId) {
	var options = "";
	for (var i in _page.events) {
		var event = _page.events[i];
		var id = "page." + event.type;
		options += "<option value='" + id + "' " + (selectId  == id ? "selected='selected'" : "") + ">" + id + "</option>";			
	}
	var controls = getControls();	
	for (var i in controls) {
		for (var j in controls[i].events) {
			var event = controls[i].events[j];
			// only if there are some actions
			if (event.actions && event.actions.length > 0) {
				var id = controls[i].id + "." + event.type;
				var text = controls[i].name + "." + event.type;
				options += "<option value='" + id + "' " + (selectId  == id ? "selected='selected'" : "") + ">" + text + "</option>";
			}
		}
	}
	return options;
}

// this function returns a set of options for a dropdown of existing actions from current controls 
function getExistingActionOptions(selectId, ignoreId) {
	var options = "";
	for (var i in _page.events) {
		var eventJS = "";
		var event = _page.events[i];
		for (var j in event.actions) {
			var action = event.actions[j];
			if (action.id != ignoreId) eventJS += "<option value='" + action.id + "' " + (action.id == selectId ? "selected='selected'" : "") + ">" + (j*1+1) + " - "  + action.type + "</option>";
		}			
		if (eventJS) options += "<optgroup label='" + _page.name + "." + event.type + "'>" + eventJS + "</optgroup>";
	}
	var controls = getControls();	
	for (var i in controls) {
		for (var j in controls[i].events) {
			var eventJS = "";
			var event = controls[i].events[j];
			for (var k in event.actions) {
				var action = event.actions[k];
				if (controls[i].name) {
					if (action.id != ignoreId) eventJS += "<option value='" + action.id + "' " + (action.id == selectId ? "selected='selected'" : "") + ">" + (k*1+1) + " - " + action.type + "</option>";
				}
			}	
			if (eventJS) options += "<optgroup label='" + controls[i].name + "." + event.type + "'>" + eventJS + "</optgroup>";
		}
	}
	return options;
}

function getDatabaseConnectionOptions(selectIndex) {
	var options = "";
	if (_version.databaseConnections) {
		for (var i in _version.databaseConnections) {
			options += "<option value='" + i + "' " + (i == selectIndex ? "selected='selected'" : "") + ">" + _version.databaseConnections[i] + "</option>";
		}
	}
	return options;
}

function getStyleClassesOptions(selected) {
	var classOptions = "";
	// loop any stye classes
	for (var i in _styleClasses) {
		classOptions += "<option" + (_styleClasses[i] == selected ? " selected='selected'" : "") + ">" + _styleClasses[i] + "</option>";
	}
	// return
	return classOptions;
}

// move the border and show properties and actions
function selectControl(control) {
	
	// clear down property dialogues for good measure
	hideDialogues();
	
	// show all details or cleanup if null
	if (control) {
		
		// store the selection globally
		_selectedControl = control;
		
		// remove any selected class
		$("#pageMap").find(".selected").removeClass("selected");
		// highlight selected control span and it's parent li
		$("#pageMap").find("span[data-id=" + control.id + "]").addClass("selected").parent().addClass("selected");
		
		// get the body into an object
		var body = $("body");
		
		// retain the current scroll positions
		var scollTop = body.scrollTop();
		var scrolLeft = body.scrollLeft();
		
		// show the properties
		showProperties(_selectedControl);
		// show the validation
		showValidation(_selectedControl);
		// show the events (and the actions)
		showEvents(_selectedControl);
		// show the styles
		showStyles(_selectedControl);
		
		
		// selectChild
		if (_selectedControl.childControls.length > 0) {
			$("#selectChild").removeAttr("disabled");
		} else {
			$("#selectChild").attr("disabled","disabled");
		}
		
		// if we have a parent control so aren't the page
		if (_selectedControl._parent) {
			
			// position and size the border
			positionAndSizeBorder(_selectedControl);
			
			// show the border if it has any size to it	and the control is visible		
			if (_selectionBorder.width() > 5 && _selectedControl.object.is(":visible")) {
				_selectionBorder.show();
			} else {
				_selectionBorder.hide();
			}
			
			// get the control class
			var controlClass = _controlTypes[_selectedControl.type];
			// get the parent control class
			var _parentClass = _controlTypes[_selectedControl._parent.type];
			// count the number of child controls
			var contCount = 0;

			// count the controls of this type			
			for (var i in _selectedControl._parent.childControls) {
				if (_selectedControl.type == _selectedControl._parent.childControls[i].type) contCount ++;
			}

			// can delete if no parent class (page control), can insert into parent, or canUserAddPeers and more than 1 peer of this type
			if (!_parentClass || _parentClass.canUserInsert || (controlClass.canUserAddPeers && contCount > 1)) {
				$("#deleteControl").removeAttr("disabled");
			} else {
				$("#deleteControl").attr("disabled","disabled");
			}
			
			// addPeerLeft and addPeerRight
			if (controlClass.canUserAddPeers) {
				$("#addPeerLeft").removeAttr("disabled");
				$("#addPeerRight").removeAttr("disabled");
			} else {
				$("#addPeerLeft").attr("disabled","disabled");
				$("#addPeerRight").attr("disabled","disabled");
			}
			
			
			// get position in parents
			for (var i in _selectedControl._parent.childControls) {
				if (_selectedControl == _selectedControl._parent.childControls[i]) break;
			}
			// turn into a number
			i = i*1;		
			// selectPeerLeft
			if (i == 0) {
				$("#selectPeerLeft").attr("disabled","disabled");
				$("#swapPeerLeft").attr("disabled","disabled");				
			} else {
				$("#selectPeerLeft").removeAttr("disabled");
				$("#swapPeerLeft").removeAttr("disabled");
			}
			
			// selectPeerRight
			if (i == _selectedControl._parent.childControls.length - 1) {
				$("#selectPeerRight").attr("disabled","disabled");
				$("#swapPeerRight").attr("disabled","disabled");
			} else {
				$("#selectPeerRight").removeAttr("disabled");
				$("#swapPeerRight").removeAttr("disabled");
			}
			
			// selectParent
			if (_selectedControl._parent) {
				$("#selectParent").removeAttr("disabled");
			} else {
				$("#selectParent").attr("disabled","disabled");
			}
											
			// paste - these rules are fairly tricky: 
			// # for pasting as a child (which is the preference)
			// controls with canUserAdd can be pasted into controls with canUserIsert
			// controls that don't have canUserAdd can be pasted into childControls if any childControls of the same type have canUserAddPeers
			// # for pasting as a peer (which is a fall-back)
			// controls with canUserAdd can be pasted into page or where parent control has canUserInsert
			// control that don't have canUserAdd can be pasted as a peer if any parent.childControls of the same type have canUserAddPeers
			var childCanAddPeers = false;
			var peerCanAddPeers = false;
			if (_copyControl) {
				// find out if there are childControls with the same type with canUserAddPeers			
				for (i in _selectedControl.childControls) {
					if (_copyControl._parent && _copyControl.type == _selectedControl.childControls[i].type && _controlTypes[_selectedControl.childControls[i].type].canUserAddPeers) {
						childCanAddPeers = true;
						break;
					}
				}
				// find out if there are peers with the same type with canUserAddPeers			
				for (i in _selectedControl._parent.childControls) {
					if (_copyControl._parent && _copyControl.type == _selectedControl._parent.childControls[i].type && _controlTypes[_selectedControl._parent.childControls[i].type].canUserAddPeers) {
						peerCanAddPeers = true;
						break;
					}
				}
			}		
			// once we know if something allowed enabling/disabling is a lot easier
			if (_copyControl && (controlClass.canUserInsert || childCanAddPeers || peerCanAddPeers)) {
				$("#paste").removeAttr("disabled");
			} else {
				$("#paste").attr("disabled","disabled");
			}
						
		} else {

			// hide the selection border (this is the page)
			_selectionBorder.hide();	
			// disable swapping of peers
			$("#swapPeerLeft").attr("disabled","disabled");
			$("#swapPeerRight").attr("disabled","disabled");
			// disable selection of parent
			$("#selectParent").attr("disabled","disabled");			
			// disable selection of peers
			$("#selectPeerLeft").attr("disabled","disabled");
			$("#selectPeerRight").attr("disabled","disabled");
			// disable adding of peers
			$("#addPeerLeft").attr("disabled","disabled");
			$("#addPeerRight").attr("disabled","disabled");
			
			// if the copy control is a canUserAdd or the page we can paste
			if (_copyControl && (!_copyControl._parent || _controlTypes[_copyControl.type].canUserAdd)) {
				$("#paste").removeAttr("disabled");
			} else {
				$("#paste").attr("disabled","disabled");
			}			
		}
						
		// show the properties panel	
		showPropertiesPanel();	
		
		// revert the scroll positions
		body.scrollTop(scollTop);
		body.scrollLeft(scrolLeft);
		
		// resize
		windowResize("selectControl");
		
	} else {
		
		_selectedControl = null;
		// hide the selection border
		_selectionBorder.hide();
						
		// hide the properties panel
		hidePropertiesPanel();
		
		// show null properties
		showProperties(null);
		// show null validation
		showValidation(null);
		// show null events (and the actions)
		showEvents(null);
		// show null styles
		showStyles(null);
		
		// resize the window
		windowResize("mousedone-nocontrol");
		
	}	
	
}

// this function shows the whole designer to the user, usually after the first page is loaded but possible earlier if there are no applications or pages
function showDesigner() {	
	// hide the loading message
	$("#loading").hide();
	// show the control panel and properties panel
	$("#designerTools").show();
	// show the page
	$("#page").show();
	// resize the elements on the page
	windowResize("showDesigner");
	// arrange any non-visible controls
	arrangeNonVisibleControls();	
	// show the first tip, if function is present
	if (window["showTip"]) showTip(0);
}

//this function load the apps into appsSelect
function loadApps(selectedAppId, forceLoad) {
	
	// hide the properties panel
	$("#propertiesPanel").hide();
	// remove all current page html
	$("#page").children().remove();
	// remove any dialogues or components
	$("#dialogues").children().remove();
	// remove any current apps
	$("#appSelect").children().remove();
	
	// do the ajax
	$.ajax({
    	url: "designer?action=getApps",
    	type: "GET",
    	contentType: "application/json",
        dataType: "json",            
        data: null,            
        error: function(server, status, error) {
        	// check if there was permission to use rapid
        	if (server && server.status == 403) {
        		// reload the whole page (sends user to login)
        		loaction.reload();
        	} else {
        		// show the error
        		alert("Error loading applications : " + error);
        	}
        },
        success: function(apps) {        	
        	// if an app is not selected try the url
        	if (!selectedAppId) var urlAppId = $.getUrlVar("a");
        	// build the select options for each app
        	var options = "";
        	// loop the apps we received
        	for (var i in apps) {        		
        		// get a reference to the app
        		var app = apps[i];
        		// add an option for this page (if not the rapid app itself)
        		options += "<option value='" + app.id + "' " + (selectedAppId || urlAppId == app.id ? "selected='true'" : "") + ">" + app.name + " - " + app.title + "</option>";        	
        	}
        	// get a reference to apps dropdown
        	var appsDropDown = $("#appSelect");
        	// put the options into the dropdown
        	appsDropDown.html(options);
        	// retain all the apps data
        	_apps = apps;        	       	
        	// load the app and its pages in the drop down if we weren't handed one
        	if (!selectedAppId || forceLoad) {
        		loadVersions();
        	} else {
        		// show the designer
        		showDesigner();
        	}
        	
        }
	});
}

//this function loads the versions into versionSelect
function loadVersions(selectedVersion, forceLoad) {
	// hide the properties panel
	$("#propertiesPanel").hide();
	// remove all current page html
	$("#page").children().remove();
	// remove any dialogues or components
	$("#dialogues").children().remove();
	// remove any current versions
	$("#versionSelect").children().remove();
	
	// do the ajax
	$.ajax({
    	url: "designer?a=" + $("#appSelect").val() + "&action=getVersions",
    	type: "GET",
    	contentType: "application/json",
        dataType: "json",            
        data: null,            
        error: function(server, status, error) {
        	// check if there was permission to use rapid
        	if (server && server.status == 403) {
        		// reload the whole page (sends user to login)
        		loaction.reload();
        	} else {
        		// show the error
        		alert("Error loading versions : " + error);
        	}
        },
        success: function(versions) {        
        	// get a reference to apps dropdown
        	var versionsDropDown = $("#versionSelect");
        	// check there are some versions
        	if (versions && versions.length > 0) {        		
        		// if an app is not selected try the url
            	if (!selectedVersion) var urlVersion = $.getUrlVar("v");
            	// build the select options for each app
            	var options = "";
            	// loop the apps we received
            	for (var i in versions) {        		
            		// get a reference to the app
            		var version = versions[i];
            		// derived the status text (these must match final ints at the top of Application.java)
            		var status = "";
            		// live = 1
            		if (version.status == 1) status = " - (Live)";
            		// add an option for this page, setting selected, in order of precidence
            		options += "<option value='" + version.version + "' " + (selectedVersion || urlVersion || versions[versions.length-1].version == version.version ? "selected='true'" : "") + ">" + version.version + status + "</option>";        	
            	}            	
            	// put the options into the dropdown
            	versionsDropDown.html(options);
            	// retain all the versions data
            	_versions = versions;        	
            	// set the selected _version
            	_version = _versions[versionsDropDown[0].selectedIndex];
            	// set the s
            	// load the app and its pages in the drop down if we weren't handed one
            	if (!selectedVersion || forceLoad) {
            		loadVersion();
            	} else {
            		// show the designer
            		showDesigner();
            	}
        		
        	} else {
        		// remove all versions
        		versionsDropDown.children().remove();
        		// remove all pages
        		$("#pageSelect").children().remove();
        		// remove all controls
        		$("#controlsList").children().remove().css("height",0);	
        		// empty page controls
        		$("#pageMapList").children().remove();
        	} // versions check	
        }
	});
}

// this function loads the version pages into pagesSelect
function loadVersion(forceLoad) {
	
	// grab a reference to the ul where the canUserAdd controls will be added
	var designControls = $("#controlsList");
	// hide the controls panel
	designControls.hide();
	// empty the designControls panel
	designControls.children().remove().css("height",0);	
	// empty the action options global
	_actionOptions = "";
	// empty the style classes array
	_styleClasses = [];
	// remove any dialogues or components
	$("#dialogues").children().remove();
	// empty the pages list
	_pages = [];
	
	// check we have some versions
	if (_versions) {
		// get the selected version Id
		_versionId = $("#versionSelect").val();
		// loop all the apps
    	for (var i in _versions) {    		
    		// if this app matches what's in the dropdown
    		if (_versions[i].version == _versionId) {
    			// set the global to this one
    			_version = _versions[i];
    			// we're done
        		break;
    		}    		
    	}
	}
			
	// check there is a version
	if (_version) {		
					
		// loop the actions
		for (var j in _version.actions) {
			// get a reference to the action
			var action = _version.actions[j];
			// add to our _actionOptions excluding the rapid action unless this is the rapid app
			if (action.type != "rapid" || _version.id == "rapid") _actionOptions += "<option value='" + action.type + "'>" + action.name + "</option>";
		}
		
		// retain the app styleclasses
		_styleClasses = _version.styleClasses;
		
		// loop the controls
    	for (var j in _version.controls) {	    	    		
    		
    		// get a reference to a single control
    		var c = _version.controls[j];      		
    		
    		// if the control can be added by the user
    		if (c.canUserAdd) {
    			
    			// add button (list item + image if exists)
    			designControls.append("<li id='c_" + c.type + "' class='design-control' data-control='" + c.type + "'>" + (c.image ? "<img src='" + c.image + "'/>" : "<img src='images/tools_24x24.png'/>") + "</li>");
    			
    			// add it's name as a help hint
    			addHelp("c_" + c.type, false, false, c.name);
    			
    			// when the mouse moves down on this component
    			designControls.children().last().on("mousedown touchstart", function(ev) {		
    				
    				// add an undo for the whole page
    				addUndo(true);
    				
    				// stop text selection as we are moving the new object
    				$("body").css({
    					"-webkit-touch-callout":"none",
    					"-webkit-user-select":"none",
    					"-khtml-user-select":"none",
    					"-moz-user-select":"-moz-none",
    					"-ms-user-select":"none",
    					"user-select":"none"
    				});	
    							
    				// hide the panel if not pinned
    				if (!_panelPinned) hideControlPanel();
    				
    				// hide the properties
    				hidePropertiesPanel();
    				
    				// get the control constructor name (way easier to use an attribute than closures)
    				var className = $(ev.target).attr("data-control");
    				if (!className) className = $(ev.target).parent().attr("data-control");
    				
					// get the control constructor
					var controlClass = _controlTypes[className];
					
					// there is a function to create this control
					if (controlClass) {    						
						// instantiate the control with the _page as the parent
						var control = new Control(className, _page, null, true);										
						// size the border for the control while it is still visible		
						sizeBorder(control);
						// set the mouseDown offsets so when we drag the mouse is in the center
						_mouseDownXOffset = -control.object.outerWidth()/2 - _panelPinnedOffset;
						_mouseDownYOffset = -control.object.outerHeight()/2;				
						// hide the control's object as we have the geometery we need
						control.object.hide();
						// show the selection border
						_selectionBorder.show();	
						// set its parent to the _page
						control._parent = _page;
						// add it to the _page childControls collection
						_page.childControls.push(control);					
						// retain a reference to the selected control					
						_selectedControl = control;	
						// show the properties
						showProperties(_selectedControl);
						// show the validation
						showValidation(_selectedControl);
						// show the events (and any actions)
						showEvents(_selectedControl);
						// show the styles
						showStyles(_selectedControl);
						// arrange the non-visible controls if our control looks like one
						if (!controlClass.canUserMove) arrangeNonVisibleControls();
						// set the _mouseDown so the moving kicks in
						_mouseDown = true;    						
					} else {
						alert("The control cannot be created. " + className + "() can't be found.");
					}    
					
					// retain that we've just added a control (we reset in mouse up)
					_addedControl = true;
					
					// rebuild the page map
					buildPageMap();
					
					// we only need the hit on the li
					ev.stopPropagation();
											
    			}).find("img").on("dragstart",function() { return false; }); // mouse down, and stop drag for image
    			
    		} // userCanAdd
    		
    	} // app control loop  
    			
    	
    	// resize the controls list (for the right height and padding)
    	sizeControlsList();

    	// load the pages with a forced page load
    	loadPages(null, true);
		
		// disable the delete button if no rapid app or this is the rapid app
		if (_version.id == "rapid") {
			$("#appDelete").attr("disabled","disabled");
		} else {
			$("#appDelete").removeAttr("disabled");
		}
		// allow editing the app
		$("#appEdit").removeAttr("appEdit");
		
	} else {
		// disable a bunch of stuff as there there are no pages and no apps
		$("#appDelete").attr("disabled","disabled");
		$("#appEdit").attr("disabled","disabled");
		$("#pageNew").attr("disabled","disabled");
		$("#pageEdit").attr("disabled","disabled");
		$("#pageSave").attr("disabled","disabled");
		$("#pageView").attr("disabled","disabled");
		// show the designer
		showDesigner();
	} // no app id
	
	// show the controls panel
	designControls.show();
	
}

// this function loads the selected apps pages into the drop down, in case the order has changed
function loadPages(selectedPageId, forceLoad) {
			
	$.ajax({
    	url: "designer?action=getPages&a=" + _version.id + "&v=" + _version.version,
    	type: "GET",
    	contentType: "application/json",
        dataType: "json",            
        data: null,            
        error: function(server, status, error) { 
        	// show the designer as there's a small chance it might not be visible yet
        	showDesigner();
        	// if it's an authentication thing
        	if (server && server.status == 403) {
        		// reload the page from the top
        		location.reload(true);
        	} else {
        		// show an error
        		alert(server.responseText || "Error loading pages : " + error);
        	}
        },
        success: function(pages) {        	       	
        	
        	// reset the next page id to 1
        	_nextPageId = 1;
        	// reset the page order changed to false
        	_pageOrderChanged = false;
        	// reset the page order reset to false
        	_pageOrderReset = false;
        	// if a page is not selected try the url
        	if (!selectedPageId) selectedPageId = $.getUrlVar("p");
        	// build the select options for each page
        	var options = "";
        	// retain the pages
        	_pages = pages;
        	
        	// loop them
        	for (var i in pages) {
        		// get a reference to the page
        		var page = pages[i];
        		// assume not selected
        		var selected = "";
        		// check if selected already or if not whether its the start page
        		if (selectedPageId == page.id || (!selectedPageId && page.startPage)) selected = "selected='true'";
        		// add an option for this page
        		options += "<option value='" + page.id + "' " + selected + ">" + page.name + " - " + page.title + "</option>";
        		// check the next pageId
        		if (parseInt(page.id.substring(1)) >= _nextPageId) _nextPageId = parseInt(page.id.substring(1)) + 1; 
        	}
        	
        	// put the options into the dropdown
        	$("#pageSelect").html(options);        	
        	// enable the new page button
        	$("#pageNew").removeAttr("disabled");
        	// check we got some pages
        	if (options) {
        		// unlock controls and page edit
        		$("#controlControls").show();
        		$("#pageEdit").removeAttr("disabled");
        		$("#pageSave").removeAttr("disabled");
        		$("#pageView").removeAttr("disabled");
        		// only if we have to do we load the selected page
        		if (forceLoad) loadPage();
        	} else {
        		// remove any current html
        		if (_page.object) _page.object.children().remove();
        		// lock controls and page edit
        		$("#controlControls").hide();
        		$("#pageEdit").attr("disabled","disabled");
        		$("#pageSave").attr("disabled","disabled");
        		$("#pageView").attr("disabled","disabled");
        		// empty the page map
            	$("#pageMapList").children().remove();
        		// show the designer
        		showDesigner();
        		// show the new page dialogue if it was an empty array
        		if ($.isArray(pages)) {
        			// hide the property panel just in case
        			hidePropertiesPanel();
        			// show the new page dialogue
        			showDialogue('~?action=page&a=rapid&p=P3'); 
        		} else {
        			// disable the new page button
        			$("#pageNew").attr("disabled","disabled");
        		}
        	}
        	
        } // success
	}); // ajax
	
}

// this function loads the controls into the page
function loadPage() {
	
	// hide the properties panel
	$("#propertiesPanel").hide();	
	// remove any dialogues or components
	$("#dialogues").children().remove();	
	// clear down property dialogues for good measure
	hideDialogues();
	// hide any selection border
	if (_selectionBorder) _selectionBorder.hide();	
	// remove any nonVisibleControls
	$(".nonVisibleControl").remove();
	// lose the selected control
	_selectedControl = null;	
	// lose the property control
	_propertiesControl = null;	
	// set the next id back
	_nextId = 1;
	// reset the control numbering
	_controlNumbers = {};
	// empty undo stack
	_undo = [];	
	// disable undo
	$("#undo").disable();
	// empty redo stack
	_redo = [];
	// disble redo
	$("#redo").disable();
	
	// get the id of the selected page
	var pageId = $("#pageSelect").val();	
	// check there is a page selected in the dropdown
	if (pageId) {										
		// set the page id
		_page.id = pageId;		
		// reload the page iFrame with resources for the app and this page
    	_pageIframe[0].contentDocument.location.href = "designpage.jsp?a=" + _version.id + "&v=" + _version.version + "&p=" + _page.id;    	
    	// set dirty to false
    	_dirty = false;    	
	} // drop down val check
	
}

//this function removes properties that create circular references from the control tree when saving
function getDataObject(object) {
	// make a new empty object
	var o = {};
	// loop the properties
	for (var i in object) {
		// ignore "static" properties, or those that create circular references
		if (i.indexOf("_") != 0 && i != "XMLVersion" && i != "object") {
			// grab a property
			var p = object[i];
			// if a blank space, or not a null
			if (p === "" || p != null) {
				// child controls and actions need cleaning up recursively 
				if (p.type && (_actionTypes[p.type] || _controlTypes[p.type])) {
					// get an object
					o[i] = getDataObject(p);
				} else if ($.isArray(p) && p.length > 0 && p[0].type && (_actionTypes[p[0].type] || _controlTypes[p[0].type] || i == "events" )) {
					// make an array
					o[i] = [];
					// loop to clean up childControls
					for (var j in p) o[i].push(getDataObject(p[j]));								
				} else {
					// simple copy
					o[i] = p;
				}
			}
		}
	}
	// return our safe object
	return o;	
}

// the page can't be strigified as is so remove the objects with the above iterative function and send that
function getSavePageData() {
	
	// retain the id of any selected control
	var selectedControlId = null;
	if (_selectedControl) selectedControlId = _selectedControl.id;
		
	// get all of the controls
	var controls = getControls();
	// create a list of roles used on this page
	var pageRoles = [];
	
	// show message
	$("#rapid_P11_C7_").html("Checking controls");
		
	// loop them looking for roles and getDetails functions to run 
	for (var i in controls) {
		// get the control
		var control = controls[i];
		// check for any roles
		if (control.roles) {			
			// loop the control's roles
			for (var j in control.roles) {
				// assume we don'y know about this role yet
				var gotRole = false;
				// loop the known roles
				for (var k in pageRoles) {
					// if we do known about the control 
					if (control.roles[j] == pageRoles[k]) {
						// record that we know
						gotRole = true;
						// stop looping
						break;
					}					
				}
				// if we've not seen this control retain it in the known collection
				if (!gotRole) pageRoles.push(control.roles[j]);
			}
		}
		// check for a get details function
		if (control._getDetails) {
			// run the get details function
			control.details = control._getDetails.apply(control, []);
		}
	}
	
	// get a page object based on the page "control" (this creates a single property array called childControls)
	var pageObject = getDataObject(_page);
					
	// get the roles from the app
	var roles = _version.roles;	
	// get all possible combinations of the roles in this page
    var combinations = []; 
    
    // show message
	$("#rapid_P11_C7_").html("Checking roles");
    
	// if this application has any explicit roles, we need to build the possible combinations
	if (pageRoles.length > 0) {
				
	 	// left shift 1 by length to raise to power of length
	    var quantity = 1 << pageRoles.length; 
	 	// loop the powered length
	    for (var i = 1; i < quantity; i++) {
	    	// combinations of this length
	        var combination = []; 
	    	// check each item
	        for (var j = 0; j < pageRoles.length; j++) {
	        	// binary and
	            if (i & (1 << j)) combination.push(pageRoles[j]);	            
	        }
	        if (combination.length !== 0) combinations.push(combination);	        
	    }
	    		
		// sort the combinations
	    combinations.sort( function(a, b) {
			// a and b are each a list of job roles
			if (a.length == b.length) {
				// loop the items
				for (var i = 0; i < a.length; i ++) {
					// retrieve the individual roles
					var aRole = a[i];
					var bRole = b[i];
					// get the min length
					var l = Math.min(aRole.length, bRole.length);
					// loop the chars
					for (var j = 0; j < l; j++) {
						// get the chars
						var aChar = aRole.charAt(j);
						var bChar = bRole.charAt(j);
						// if different return
						if (aChar != bChar) return aChar - bChar; 
					}
					// if we got all the way here use length of string
					return aRole.length - bRole.length;
				}
			} else {
				// return the difference in length
				return b.length - a.length;
			}
		});
	    	    		
	}
	
	// add a combination to represent a user with no roles
	combinations.push([]);
	
	// add an array to the page object for the each role combination html
    pageObject.rolesHtml = [];
    
    // show message
	$("#rapid_P11_C7_").html("Generating html");
    
    // for each combination
    for (var i in combinations) {
    	
    	// get the combination
    	var combination = combinations[i];
    	
    	// get a fresh set of all the controls (as new html will have been added in the regeneration between combinations)
    	controls = getControls();
    	// get a fresh role controls array
    	var roleControls = [];
    	    	    	
    	// loop them looking for roles, and pre-save functions to run 
    	for (var j in controls) {    		
    		// get the control
    		var control = controls[j];
    		// check for roles
    		if (control.roles && control.roles.length > 0) {
    			// remember this control has roles
    			roleControls.push(control);
    		}
    		// check for a pre-save function
    		if (control._save) {
    			control._save();
    		}
    	}
    	
    	// loop only the controls that have roles, removing them if no role in this combination
    	for (var j in roleControls) {
    		// get an instance of the control
    		var roleControl = roleControls[j];
    		// assume we don't have the role in this combination
    		var gotRole = false;
    		// loop the controls roles (should be smaller than combination roles)
    		for (var k in roleControl.roles) {
    			// loop the combination
	    		for (var l in combination) {
	    			// if a role in the control is present in the combination
	    			if (roleControl.roles[k] == combination[l]) {
	    				// remember we've got the role
	    				gotRole = true;
	    				// exit the combination loop
	    				break;
	    			}
	    		}
	    		// exit the control role loop if we found the role earlier
	    		if (gotRole) break;
    		}
    		// remove the control if we don't have a role for it in this combination
    		if (!gotRole) roleControl._remove();	    		
    	}
    	
    	// add the html for this security role combination to the pageObject rolesHtml property
    	pageObject.rolesHtml.push( { roles : combination, html :  _page.object.html() });
    	    	
    	// remove any dialogues or components
    	$("#dialogues").children().remove();
    	// empty the child controls collection
    	_page.childControls = [];
    	// remove the child controls from the page
    	_page.object.children().remove();
    		    	
    	// loop the current page childControls and re-create
    	for (var j = 0; j < pageObject.childControls.length; j++) {
    		// get an instance of the control properties (which is what we really need from the JSON)
    		var control = pageObject.childControls[j];
    		// create and add (using the undo routine)
    		_page.childControls.push( loadControl(control, _page, true, false, true));
    	}
    	// arrange any non-visible controls
    	arrangeNonVisibleControls();
    		    		    	
    }
    
    // add the page html this is used by the designer and is always the html for the combination with the most roles
	pageObject.htmlBody = pageObject.rolesHtml[0].html;
	
	// add the pages if their order has been changed
	if (_pageOrderChanged) pageObject.pages = _pages;
	// add whether the page order had been reset
	pageObject.pageOrderReset = _pageOrderReset;
		
	// stringify the page control object and add to the page (this creates an array called childControls)
	var pageData = JSON.stringify(pageObject);
	
	// re-selected any selected control
	if (selectedControlId) {
		// re-select the initial control
		_selectedControl = getControlById(selectedControlId);
		// rebuild any properties
		selectControl(_selectedControl);
	}
	
	// show message
	$("#rapid_P11_C7_").html("Sending html...");
		
	// return it
	return pageData;	
}

function cleanControlForPaste(control) {
	// create an empty clean control object
	var cleanControl = {};	
	// loop the properties, ignoring certain ones
	for (var i in control) {
		if (i.indexOf("_") != 0 && i != "object" && i != "childControls") {
			cleanControl[i] = control[i];
		}
	}
	// add a child control collection
	cleanControl.childControls = [];
	// loop the child controls
	for (var i in control.childControls) {
		// add a clean child control
		cleanControl.childControls.push(cleanControlForPaste(control.childControls[i]));
	}
	// return the clean control
	return cleanControl;
}

function applyStyleForPaste(control) {
	// check has style
	if (control.styles) {
		// loop them
		for (var i in control.styles) {
			var style = control.styles[i];
			var appliesTo = style.appliesTo;
			// create a style sheet rule
			var styleSheetRule = "";
			// loop the style rows and add to the style rules
			for (var j in style.rules) {
				// get the rule 
				var rule = style.rules[j];
				// if we got something 
				if (rule) {
					// add it to the styleSheetRule
					styleSheetRule += rule;
				}
			};
			// if there are rules
			if (style.rules.length > 0) {
				
				// add the styleSheet rule
				if (_styleSheet) {
					// check whether the stylesheet has an insertRule method
					if (_styleSheet.insertRule) {
						// ff / chrome - create a single rule inside the applies to
						styleSheetRule = appliesTo + " {" + styleSheetRule + "}";
						// insert to send of style sheet
						_styleSheet.insertRule(styleSheetRule, _styleSheet.cssRules.length);
					} else {
						// ie - use addRule method with seperate applies to and rule 						
						_styleSheet.addRule(appliesTo, styleSheetRule);
					}									
				} // _styleSheet check								
				
			} // rules check
		} // control styles loop
	} // control styles check
	// loop child controls
	for (var i in control.childControls) {
		// add their styles too
		applyStyleForPaste(control.childControls[i]);
	}
}

// this function will paste an existing control into a specified parent - if no parent is specified we assume we are pasting a whole page
function doPaste(control, _parent) {
		
	// remove any dialogues or components
	$("#dialogues").children().remove();
	
	// reset the paste map
	_pasteMap = {};
	
	// it's a little different for the page (we can idenitfy it as it doesn't have a parent)
	if (_parent) {
		
		// create the new control
		var newControl = loadControl(control, _parent, true, true);
		
		// retain the next id at this point
		var nextId = _nextId;
		
		// retain the control numbers at this point
		var controlNumbers = JSON.stringify(_controlNumbers);
		
		// remove the current object if not the body
		if (!newControl.object.is("body")) newControl._remove();
		
		// remove any items that were placed in dialogues
		$("#dialogues").children().remove();
		
		// clean the control for stringifying
		var cleanControl = cleanControlForPaste(newControl);
		
		// stringify newControl
		var newControlString = JSON.stringify(cleanControl);
		
		// loop all entries in the paste map
		for (var i in _pasteMap) {
			// update all references
			newControlString = newControlString.replaceAll(_pasteMap[i],i);
		}
		
		// turned the replaced string back into an object
		var mappedControl = JSON.parse(newControlString);
		
		// reload the control with all the new references
		newControl = loadControl(mappedControl, _parent, true, true);
		
		// apply any styling in the new control
		applyStyleForPaste(newControl);
		
		// restore the next id
		_nextId = nextId;
		
		// restore the control numbers
		_controlNumbers = JSON.parse(controlNumbers);
		
		// fire window resize in case scroll bars need adjusting, etc. (this will re-select)
		windowResize("paste");
								
		// return the updated control
		return newControl;
				
	} else {
			
		// remove all children
		_page.object.children().remove();																				
		// reset the next id at this point
		_nextId = 1;
		// reset the control numbers at this point
		_controlNumbers = {};
		// retain the page id
		var id = _page.id;
		// retain the page name
		var name = _page.name;
		// retain the page name
		var title = _page.title;
		// retain the page name
		var description = _page.description;
				
		// stringify control
		var controlString = JSON.stringify(control);
		
		// update all references of the page id to this page id
		controlString = controlString.replaceAll(control.id + "_",id + "_");
		
		// turned the replaced string back into an object
		var mappedControl = JSON.parse(controlString);
		
		// add back object from the current page
		mappedControl.object = _page.object;
		
		// reload the page control using the undo functionality (this preserves the control ids)
		_page = loadControl(mappedControl, null, true, false, true);

		// restore the id
		_page.id = id;
		// restore the name
		_page.name = name;
		// restore the title
		_page.title = title;
		// restore the description
		_page.description = description;
		// set the page object to the iframe body
		_page.object = $(_pageIframe[0].contentWindow.document.body);
		
		// apply any styling in the new control
		applyStyleForPaste(_page);
		
		// fire window resize in case scroll bars need adjusting, etc.
		windowResize("paste");
		
		// return the page
		return _page;		
		
	}
			
}

// a function for animating the hide/show headers
function toggleHeader(ev) {
	var header = $(this);
	var contents = header.next();
	contents.slideToggle( 500, function() {
		if (contents.is(":visible")) {
			header.children("img.headerToggle").attr("src","images/triangleUp_8x8.png");						
		} else {
			header.children("img.headerToggle").attr("src","images/triangleDown_8x8.png");
		}
		switch (header.attr("id")) {
		case "stylesHeader" :
			_stylesHidden = !contents.is(":visible");
			break;
		case "styleClasssesHeader":
			_styleClassesHidden = !contents.is(":visible");
			break;
		}
		windowResize("toggleHeader");
	});		
	return false;	
}

// JQuery is ready! 
$(document).ready( function() {
	
	//console.log("Jquery is ready!");
	
	// derive the scroll bar width first - http://stackoverflow.com/questions/986937/how-can-i-get-the-browsers-scrollbar-sizes
	var inner = document.createElement('p');
	inner.style.width = "100%";
	inner.style.height = "200px";

	var outer = document.createElement('div');
	outer.style.position = "absolute";
	outer.style.top = "0px";
	outer.style.left = "0px";
	outer.style.visibility = "hidden";
	outer.style.width = "200px";
	outer.style.height = "150px";
	outer.style.overflow = "hidden";
	outer.appendChild (inner);

	document.body.appendChild (outer);
	var w1 = inner.offsetWidth;
	outer.style.overflow = 'scroll';
	var w2 = inner.offsetWidth;
	if (w1 == w2) w2 = outer.clientWidth;

	document.body.removeChild(outer);

	_scrollBarWidth = (w1 - w2);
			
	// the window we are working in
	_window = $(window);	
	
	// check if we have local storage
	if (typeof(localStorage) !== "undefined") {
		// if we have a saved control panel width
		if (localStorage["_sizes"]) {
			// retain it locally
			_sizes = JSON.parse(localStorage["_sizes"]);
			// set controlPanelWidth if present
			if (_sizes["controlPanelWidth"]) sizeControlsList(_sizes["controlPanelWidth"]);
			// set propertiesPanelWidth if present
			if (_sizes["propertiesPanelWidth"]) $("#propertiesPanel").width(_sizes["propertiesPanelWidth"]);
		}
	}
	
	// derived the panel pinned offset value (add on the padding and border)
	_panelPinnedOffset = $("#controlPanel").width() + 21;
	
	//  if we move away from this page
	_window.on('beforeunload', function(){
		// save the _sizes object if local storage
		if (typeof(localStorage) !== "undefined") localStorage["_sizes"] = JSON.stringify(_sizes);
		// check for unsaved page changes
		if (_dirty) return 'You have unsaved changes.';
	});
	// attach a call to the window resize function to the window resize event listener
	_window.resize("windowResize", windowResize);		
	// reposition the selection if there's a scroll
	_window.scroll( function(ev) {
		positionAndSizeBorder(_selectedControl);
	});
	
	// scroll the iFrame top if it's outer scroll bar is used
	$("#scrollV").scroll( function(ev) {
		_pageIframeWindow.scrollTop($(ev.target).scrollTop());
		positionBorder(_selectedControl);		
	});
	// scroll the iFrame left if it's outer scroll bar is used
	$("#scrollH").scroll( function(ev) {
		_pageIframeWindow.scrollLeft($(ev.target).scrollLeft());
		positionBorder(_selectedControl);
	});
	
	// the iframe in which we load the page
	_pageIframe = $("#page");		
	// the iframe window that tells us about it's scroll positions
	_pageIframeWindow = $(_pageIframe[0].contentWindow);
			
	// the div that covers all of the components in design mode so they don't react to clicks
	_designCover = $("#designCover");
			
	// load the action classes
	$.ajax({
    	url: "designer?action=getSystemData",
    	type: "GET",
    	contentType: "application/json",
        dataType: "json",       
        data: null,            
        error: function(server, status, error) {
        	// just show an error        	
        	alert("Error loading system data : " + error); 
        },
        success: function(systemData) {        
        	
        	// check we got some
        	if (systemData) {
        		
        		// get the actions
        		var actions = systemData.actions;
        		
        		// loop the actions we got back
    	    	for (var i in actions) {
    	    		// get a reference to a single action
    	    		var a = actions[i];
    	    		// create a new action class object/function (this is a closure)
    	    		var f = new ActionClass(a);        		        		     			
    				// retain the action class object/function globally
    	    		_actionTypes[a.type] = f; 	    		
    	    	} // action loop
        		
        		// get the controls
        		var controls = systemData.controls;
        		
        		// loop the controls we got back
    	    	for (var i in controls) {
    	    		// get a reference to a single control
    	    		var c = controls[i];
    	    		// create a new control ControlClass object/function (this is a closure)
    	    		var f = new ControlClass(c);        		        		     			
    				// retain the control controlClass function function globally
    				_controlTypes[c.type] = f; 	
    	    	}
        		
        		// if we got devices store them globally
        		if (systemData.devices) _devices = systemData.devices;
        		        		
        		// check if we have local storage
        		if (typeof(localStorage) !== "undefined") {
        			// retrieve device index from local storage
        			var device = localStorage.getItem("_device");
        			// if there was one and there's a slot for it in our devices
        			if (device && device * 1 < _devices.length) _device = device*1;
        			// retrieve the orientation
        			var orientation = localStorage.getItem("_orientation");
        			// update global if we got one
        			if (orientation) _orientation = orientation;
        			// retrieve the zoom
        			var zoom = localStorage.getItem("_zoom");
        			// update global if we got one
        			if (zoom) _zoom = zoom*1;
        			// calculate the scale
        			_scale = _ppi / _devices[_device].PPI * _devices[_device].scale * _zoom;
        		}
        		
        		// now load the apps
    	    	loadApps();	
        		
        	} // got system data
	    	        		    		    		    	
        } // load actions success function
        
    }); // load actions ajax
	
	// when we load an app the iframe is refreshed with the resources for that app and page
	_pageIframe.load( function () {	
								
		// scroll to the top left
		$("#scrollV").scrollTop(0);
		$("#scrollH").scrollLeft(0);
		
		// only if the app and page id's have been set
		if (_version.id && _page.id) {
			
			// now load the page definition with ajax
			$.ajax({
		    	url: "designer?action=getPage&a=" + _version.id + "&v=" + _version.version + "&p=" + _page.id,
		    	type: "GET",
		    	contentType: "application/json",
		        dataType: "json",            
		        data: null,            
		        error: function(server, status, error) { 
		        	// ensure the designer is visble
		        	showDesigner();
		        	// if it's an authentication thing
		        	if (server && server.status == 403) {
		        		// reload the page from the top
		        		location.reload(true);
		        	} else {
		        		// show an error
		        		alert("Error loading page : " + error);
		        	}
		        },
		        success: function(page) {       
		        	
		        	try {
		        		
		        		// find the header section
			    		var head = $(_pageIframe[0].contentWindow.document).find("head");
		        		
		        		// remove any current app style sheets
			    		head.find("link[rel=stylesheet][href$='/rapid.css']").remove();
			    		// remove any current page style sheets
			    		head.find("link[rel=stylesheet][href$='/" + _page.id + ".css']").remove();
			    		
		        		// retain the childControls
		        		var childControls = page.controls;
		        				        		
		        		// remove them from the page object
		        		delete page.controls;
		        		
		        		// create the page (control) object
			        	_page = new Control("page", null, page, true);
			        	
			        	// retain the iframe body element as the page object
			    		_page.object = $(_pageIframe[0].contentWindow.document.body);
			    					    					    					    		
			    		// hide it
			    		_page.object.hide();
			    		
			    		// empty it
			    		_page.object.children().remove();
    				    					    		
			    		// make sure the app styling is correct (this can go wrong if the back button was clicked which loads the current page but the previous styling)
			    		head.append("<link rel=\"stylesheet\" type=\"text/css\" href=\"" + _version.webFolder + "/rapid.css\">");
			    		// make sure the page styling is correct (this can go wrong if the back button was clicked which loads the current page but the previous styling)
			    		head.append("<style type=\"text/css\">" + page.css + "</style>");
	     	
			        	// if we have childControls
			        	if (childControls) {
				        	// loop the page childControls and create
				        	for (var i = 0; i < childControls.length; i++) {
				        		// get an instance of the control properties (which is what we really need from the JSON)
				        		var childControl = childControls[i];
				        		// create and add
				        		_page.childControls.push(loadControl(childControl, _page, true));
				        	}
			        	}
			        	
			        	// get all of the stylesheets (we might be using pagepanels where the styling )
						var styleSheets = _pageIframe[0].contentWindow.document.styleSheets;
						// check we got some stylesheets
						if (styleSheets) {
							// loop them
							for (var i = 0; i < styleSheets.length; i++) {
								// get a reference
								styleSheet = styleSheets[i];
								// control styles are always in the page and will not have an href
								if (!styleSheet.href) {
									// if this style sheets sits in the document head section retain it as the pageStyleSheet
									if (styleSheet.ownerNode.parentNode.nodeName == "HEAD") _styleSheet = styleSheet;									
								} // in-page style check
							} // style sheets loop
						} // style sheets check
						
						// if we have local storage
						if (typeof(localStorage) !== "undefined") {
							// if we have a local storage for the guidelines
							if (localStorage.getItem("_guidelines")) {
								// read the value of whether to show guidelines
								var showGuidelines = JSON.parse(localStorage.getItem("_guidelines"));
								// show if so (details in properties.js, functions in styles.js)
								if (showGuidelines) {
									// loop the guidline styles
									for (var i in _guidelineStyles) {
										// remove the style just to be sure
										removeStyle(_guidelineStyles[i],"designPage.css");
										// if we want the style add it back in
										if (showGuidelines) 	addStyle( _guidelineStyles[i],"border: 1px dashed #ccc;margin: -1px;");	
									}
								}
							} 
						}
			        				        	
			        	// show the page object
			        	_page.object.show();	
			        	
			        	// make everything visible
			        	showDesigner();
			        	
			        	// refresh the page map
			        	buildPageMap();
			        	
			        	// get the page lock object
			        	var lock = _page.lock;
			        	
			        	// if there is a lock and the userName is different (see how the userName is set at the top of the design.jsp)
			        	if (lock && lock.userName && lock.userName.toLowerCase() != _userName.toLowerCase()) {
			        				        		
			        		// set that this page is locked
			        		_locked = true;
			        		
			        		// hide / disable certain features
			        		$("#pageLock").show().children().first().html("This page is locked for editing by " + lock.userDescription);	
			        		$("#pageSave").attr("disabled","disabled");
			        		$("#controlControls").hide();			        		
	        		
			        		// show alert
			        		alert("This page was locked for editing by " + lock.userDescription + " at " + lock.formattedDateTime + ".\nYou will not be able to make or save changes to this page until they start work on a different page, or an hour has passed.");
			        					        					        		
			        	} else {
			        		
			        		// no lock make sure all functionality is present
			        		_locked = false;
			        		// show / enable features
			        		$("#pageLock").hide();
			        		$("#pageSave").removeAttr("disabled");
			        		$("#controlControls").show();
			        	}
			        	
			        	// fire the page resize code
			        	windowResize("pageLoaded");
			        	
			        	// update the url
			        	if (window.history && window.history.replaceState) window.history.replaceState("page", _page.title, "design.jsp?a=" + _version.id + "&v=" + _version.version + "&p=" + _page.id );
			        				        	
		        	} catch (ex) {
		        		
		        		// ensure the designer is visible
			        	showDesigner();
		        		// show an error
		        		alert("Error loading page : " + ex);	
		        		
		        	}
		        			       		        		        		        			        			        		
		        } // success function
		        
			}); // ajax
		}
		
		// remove all children of the dialogues element as for some reason on a back button press they can appear here
		$("#dialogues").children().remove();
				
	});
					
	// the div which we use a border around the selected object
	_selectionBorder = $("#selectionBorder");
	// the div which we cover the selected object with whilst we are moving it around
	_selectionCover = $("#selectionCover");
	// the div which we place to show where a move/insert would occur on the left
	_selectionMoveLeft = $("#selectionMoveLeft");
	// the div which we place to show where an move/insert would occur on the right
	_selectionMoveRight = $("#selectionMoveRight");
	// the div with the down arrow which we place to show where an insert would occur
	_selectionInsert = $("#selectionInsert");
	// the cover for the control we are inserting into
	_selectionInsertCover = $("#selectionInsertCover");
	
	_selectionBorder.on("mousedown touchstart", coverMouseDown );
	
	// the div into which all the styles go
	_stylesPanelDiv = $("#stylesPanelDiv");
	// the editiable div in which we input the style rule name or value
	_styleInput = $("#styleInput");
	// a span that hints at what would be selected
	_styleHint = $("#styleHint");
	// a list of matching style rules
	_styleList = $("#styleList");
	
	
	$("#selectionBorder").on("mouseover", function(ev){
		if (_selectedControl) {
			if (ev.target != _mousedOverControl) {
				_selectedControl.object.trigger("mouseover", [ev]);
				_mousedOverControl = ev.target;
			}
		}
	});

	$("#selectionBorder").on("mouseout", function(ev){
		if (_selectedControl) _selectedControl.object.trigger("mouseout", [ev]);
		_mousedOverControl = null;
	});
		
	// control panel resize
	$("#controlPanelSize").on("mousedown", function(ev) {
		// retain that we are resizing the control panel
		_controlPanelSize = true;
		// retain the mouse offset
		_mouseDownXOffset = ev.pageX - parseInt($("#controlPanel").css("width"));
	});
	
	// property panel resize
	$("#propertiesPanelSize").on("mousedown", function(ev) {
		// retain that we are resizing the control panel
		_propertiesPanelSize = true;
		// retain the mouse offset
		_mouseDownXOffset = ev.pageX - $("#propertiesPanel").offset().left;
	});
		
	// panel pin
	$("#controlPanelPin").click( function(ev) {
		// check pinned
		if (_panelPinned) {
			_panelPinned = false;			
			$("#controlPanelPin").html("<img src='images/triangleDown_8x8.png' title='pin panel'>");
			// set the panel pin offset
			_panelPinnedOffset = 0;			
			// arrange the non visible controls due to the shift in the panel
			arrangeNonVisibleControls();	
			// reselect control
			selectControl(_selectedControl);
			// hide control panel
			hideControlPanel();
		} else {
			_panelPinned = true;
			_panelPinnedOffset = $("#controlPanel").width() + 21; // add the padding and border
			$("#controlPanelPin").html("<img src='images/triangleLeft_8x8.png' title='unpin panel'>");
			// resize the window
			windowResize("unpin");
			// arrange the non visible controls due to the shift in the panel
			arrangeNonVisibleControls();
			// reselect control
			selectControl(_selectedControl);			
		}
	});
	
	// panel slide out
	$("#controlPanelShow").mouseenter( function(ev){
		// show the panel if we're not moving a control
		if (!_movingControl) {
			// show the panel
			$("#controlPanel").stop(true, true).show("slide", {direction: "left"}, 200, function() {
				// show the inner when the animation has finished
				$("#controlPanelInner").show();
			});			
		}
	});
	
	// panel slide in
	$("#controlPanel").mouseleave( function(ev){		
		// if the panel isn't pinned and this not the selected control
		if (!_panelPinned && !$(ev.target).is("select")) {
			// slide the control panel back in
			hideControlPanel(true);	
		}
	});

	// if we click on the cover (have we hit a control)
	$("#designCover").on("mousedown touchstart", coverMouseDown ); // cover mouseDown	
	
	// administration
	$("#appAdmin").click( function(ev) {
		if (_version && _version.id) {
			window.location = "~?a=rapid&appId=" + _version.id + "&version=" + _version.version;
		} else {
			window.location = "~?a=rapid";
		}		 
	});
	
	// load app
	$("#appSelect").change( function() {
    	// load the selected app and its pages in the drop down 
    	if (checkDirty()) {
    		loadVersions();
    	} else {
    		// revert the drop down on cancel
    		$("#appSelect").val(_version.id);
    	}
	});
	
	// load version
	$("#versionSelect").change( function() {
    	// load the selected app and its pages in the drop down 
    	if (checkDirty()) {
    		loadVersion();
    	} else {
    		// revert the drop down on cancel
    		$("#versionSelect").val(_version.version);
    	}
	});
			
	// load page
	$("#pageSelect").change( function() {
		// load the selected page
		if (checkDirty()) {
			loadPage();
		} else {
			// revert the drop down on cancel
			$("#pageSelect").val(_page.id);
		}
	});
	
	// new page
	$("#pageNew").click( function(ev) {
		if (checkDirty()) showDialogue('~?action=page&a=rapid&p=P3'); 
	});
	
	// edit page
	$("#pageEdit").click( function(ev) {
		// hide any selection border
		_selectionBorder.hide();
		// set the selected control to the page
		selectControl(_page);		
	});
			
	// save page
	$("#pageSave").click( function() {
		
		// hide all dialogues
		hideDialogues();
		
		// show the saving page dialogue with 
		showDialogue('~?action=page&a=rapid&p=P11', function() {
			
			// show message
			$("#rapid_P11_C7_").html("Saving page...");
			
			// send the data to the backend
			$.ajax({
		    	url: "designer?action=savePage&a=" + _version.id + "&v=" + _version.version,
		    	type: "POST",
		    	contentType: "application/json",
		        dataType: "json",            
		        data: getSavePageData(),            
		        error: function(server, status, error) { 
		        	// show error
		        	$("#rapid_P11_C7_").html(error);
		        	// enable close button
		        	$("#rapid_P11_C10_").enable().focus();
		        },
		        success: function(controls) {
		        	// show message
		        	$("#rapid_P11_C7_").html("Page saved!");
		        	// enable close button
		        	$("#rapid_P11_C10_").enable().focus();
		        	// set dirty to false
		        	_dirty = false;
		        	// reload the pages as the order may have changed, but keep the current one selected
		        	loadPages(_page.id);		        	
		        	// arrange any non-visible controls
		        	arrangeNonVisibleControls();	   
		        	// iframe resize
		    		_pageIframe.resize();
		        }
			});
			
		});
		
	});
	
	// view page
	$("#pageView").click( function(ev) {
		// page unload will prompet the user if the page is dirty
		window.location = "~?a=" + _version.id + "&v=" + _version.version + "&p=" + _page.id;
	});
	
	// undo
	$("#undo").click( function(ev) {
		doUndo(); 
		buildPageMap();
	});
	
	// redo
	$("#redo").click( function(ev) {
		doRedo();
		buildPageMap();
	});
	
	// controls are clicked on
	$("#controlsHeader").click( toggleHeader );
			
	// page controls are clicked on
	$("#controlsMap").click( toggleHeader );
			
	// control search
	$("#pageMapSearch").keyup( function(ev) {
		// get the current value
		var val = $(ev.target).val();
		// lowercase it if we got one
		if (val) val = val.toLowerCase();
		// get the flat list of controls
		var controls = getControls();
		// loop the controls
		for (var i in controls) {
			// get the control
			var c = controls[i];
			// check the id or name
			if (c.id.toLowerCase().indexOf(val) > -1 || (c.name &&  c.name.toLowerCase().indexOf(val) > -1)) {
				// if control is different from currently selected, select this one
				if (!_selectedControl || _selectedControl.id != c.id) selectControl(c);
				// we're done!
				break;
			}
		}
		
	});
	
	// control highlight
	$("#pageMapHighlight").click( function(ev){
		scrollMapToSelectedControl(true);
	});
	
	// properties panel pin (for now just hide)
	$("#propertiesPanelPin").click( function(ev) {
		// select a null control (this does a lot of cleanup)
		selectControl(null);				
		// hide the select border
		_selectionBorder.hide();
	});
							
	// select parent
	$("#selectParent").click( function(ev) {
		// if we have a _parent
		if (_selectedControl._parent) {			 
			// select the parent
			selectControl(_selectedControl._parent);
		}
	});
	
	// select child
	$("#selectChild").click( function(ev) {
		// maker sure there is a childControl to go to
		if (_selectedControl.childControls.length > 0) {
			// select the first visible child
			for (var i in _selectedControl.childControls) {
				if (_selectedControl.childControls[i].object.is(":visible") || _selectedControl.childControls[i].type == "custom") {
					selectControl(_selectedControl.childControls[i]);
					break;
				}
			}			
		}
	});
		
	// select left peer
	$("#selectPeerLeft").click( function(ev) {
		// maker sure there we've not got the left most control already
		if (_selectedControl != _selectedControl._parent.childControls[0]) {
			// find our position
			for (var i in _selectedControl._parent.childControls) {
				if (_selectedControl == _selectedControl._parent.childControls[i]) break;
			}
			// run any control selection code - for complex controls that may need to update their parent
			if (_selectedControl._selectLeft) _selectedControl._selectLeft();
			// select the childControl before this one 
			selectControl(_selectedControl._parent.childControls[i*1-1]);
		}
	});
	
	// select right peer
	$("#selectPeerRight").click( function(ev) {
		// maker sure there we've not got the right most control already
		if (_selectedControl != _selectedControl._parent.childControls[_selectedControl._parent.childControls.length - 1]) {
			// find our position
			for (var i in _selectedControl._parent.childControls) {
				if (_selectedControl == _selectedControl._parent.childControls[i]) break;
			}
			// run any control selection code - for complex controls that may need to update their parent
			if (_selectedControl._selectRight) _selectedControl._selectRight();
			// select the childControl before this one if it's visible
			selectControl(_selectedControl._parent.childControls[i*1+1]);
		}
	});
			
	// swap peer left
	$("#swapPeerLeft").click( function(ev) {
		// maker sure there we've not got the left most control already
		if (_selectedControl != _selectedControl._parent.childControls[0]) {
			// add an undo snapshot for the whole page
			addUndo(true);
			// find our position
			for (var i in _selectedControl._parent.childControls) {
				if (_selectedControl == _selectedControl._parent.childControls[i]) break;
			}
			// remove control from parent childControls
			_selectedControl._parent.childControls.splice(i,1);
			// add back one position earlier
			_selectedControl._parent.childControls.splice(i*1-1,0,_selectedControl);
			// check if there is a routine for the swap
			if (_selectedControl._swapLeft) {
				// run the function
				_selectedControl._swapLeft();
			} else {				
				// move object
				_selectedControl.object.insertBefore(_selectedControl._parent.childControls[i*1].object);
			}
			// arrange any non visible controls
			arrangeNonVisibleControls();
			// re-select the control
			selectControl(_selectedControl);
			// rebuild the page map
			buildPageMap();
		}
	});
	
	// swap peer right
	$("#swapPeerRight").click( function(ev) {
		// maker sure there we've not got the right most control already
		if (_selectedControl != _selectedControl._parent.childControls[_selectedControl._parent.childControls.length - 1]) {
			// add an undo snapshot for the whole page
			addUndo(true);
			// find our position
			for (var i in _selectedControl._parent.childControls) {
				if (_selectedControl == _selectedControl._parent.childControls[i]) break;
			}
			// remove control from parent childControls
			_selectedControl._parent.childControls.splice(i,1);
			// add back one position later
			_selectedControl._parent.childControls.splice(i*1+1,0,_selectedControl);
			// check if there is a routine for the swap
			if (_selectedControl._swapRight) {
				// run the function
				_selectedControl._swapRight();
			} else {
				// just move the object
				_selectedControl.object.insertAfter(_selectedControl._parent.childControls[i*1].object);
			}			
			// arrange any non visible controls
			arrangeNonVisibleControls();
			// re-select the control
			selectControl(_selectedControl);
			// rebuild the page map
			buildPageMap();
		}
	});
		
	// add peer left
	$("#addPeerLeft").click( function(ev) {
		// check whether adding of peers is allowed
		if (_selectedControl && _controlTypes[_selectedControl.type].canUserAddPeers) {
			// add an undo snapshot for the whole page
			addUndo(true);
			// create a new control of the selected class
			var newControl = new Control(_selectedControl.type, _selectedControl._parent, null, true);						
			// run any control insertion code - for complex controls that may need to update their parent
			if (newControl._insertLeft) {
				newControl._insertLeft();
			} else {
				// add it to the parent in the correct position
				_selectedControl._parent.childControls.splice(_selectedControl.object.index(), 0, newControl);	
				// move the object
				newControl.object.insertBefore(_selectedControl.object);							
			}			
			// select the new one
			selectControl(newControl);
			// rebuild the page map
			buildPageMap();
		}
		
	});
	
	// add peer right
	$("#addPeerRight").click( function(ev) {
		// check whether adding of peers is allowed
		if (_selectedControl && _controlTypes[_selectedControl.type].canUserAddPeers) {
			// add an undo snapshot for the whole page
			addUndo(true);
			// create a new control of the selected class
			var newControl = new Control(_selectedControl.type, _selectedControl._parent, null, true);					
			// run any control insertion code - for complex controls that may need to update their parent
			if (newControl._insertRight) {
				newControl._insertRight();
			} else {
				// add it to the parent in the correct position
				_selectedControl._parent.childControls.splice(_selectedControl.object.index() + 1, 0, newControl);
				// move the object
				newControl.object.insertAfter(_selectedControl.object);				
			}			
			// select the new one
			 selectControl(newControl);
			// rebuild the page map
			 buildPageMap();
		}
		
	});
	
	// delete control
	$("#deleteControl").click( function(ev) {
		// there must be a selected control
		if (_selectedControl) {
			// check this control isn't the page (shows dialogue if so)
			if (_selectedControl._parent) {
				var contCount = 0;
				// count the controls of this type
				for (var i in _selectedControl._parent.childControls) {
					if (_selectedControl.type == _selectedControl._parent.childControls[i].type) contCount ++;
				}
				// can delete if no parent class (page control), can insert into parent, or canUserAddPeers and more than 1 peer of this type
				if (_controlTypes[_selectedControl._parent.type].canUserInsert || (_controlTypes[_selectedControl.type].canUserAddPeers && contCount > 1)) {				
					// add an undo snapshot for the whole page
					addUndo(true);
					// call the remove routine
					_selectedControl._remove();
					// find our position
					for (var i in _selectedControl._parent.childControls) {
						if (_selectedControl == _selectedControl._parent.childControls[i]) break;
					}
					// remove from parents child controls
					_selectedControl._parent.childControls.splice(i,1);				
					// if no controls remain reset the nextid and control numbers
					if (_page.childControls.length == 0) {
						_nextId = 1;
						_controlNumbers = {};
					}
					// remove any possible non-visible object
					$("#" + _selectedControl.id + ".nonVisibleControl").remove();
					// arrange the non visible page controls
					arrangeNonVisibleControls();
					// hide the selection and properties panel
					selectControl(null);
					// rebuild the page map
					buildPageMap();
				}			
			} else {
				showDialogue('~?a=rapid&p=P4');
			}
		} 		
	});
	
	// copy
	$("#copy").click( function(ev) {
		// if there is a selected control
		if (_selectedControl) {
			// treat the page differently
			if (_selectedControl._parent) {
				_copyControl = _selectedControl;
			} else {
				_copyControl = cleanControlForPaste(_selectedControl);
			}
		}
		if (_copyControl) $("#paste").removeAttr("disabled");
	});
	
	// paste
	$("#paste").click( function(ev) {
		// see the enable/disable rules for the past button to see all the rules but basically we're working out whether we can insert into the selected control, into the parent, or not at all
		if (_copyControl) {
			// assume we're pasting into the selected control
			var pasteControl = _selectedControl;
			// if no selected control use the page
			if (!pasteControl) pasteControl = _page;
			// add an undo snapshot for the whole page
			addUndo(true);
			// if no parent it's the page
			if (pasteControl._parent) {
				// find out if there are childControls with the same type with canUserAddPeers
				var childCanAddPeers = false;
				for (i in pasteControl.childControls) {
					if (_copyControl.type == pasteControl.childControls[i].type && _controlTypes[pasteControl.childControls[i].type].canUserAddPeers) {
						childCanAddPeers = true;
						break;
					}
				}
				// find out if there are peers with the same type with canUserAddPeers
				var peerCanAddPeers = false;
				for (i in pasteControl._parent.childControls) {
					if (_copyControl.type == pasteControl._parent.childControls[i].type && _controlTypes[pasteControl._parent.childControls[i].type].canUserAddPeers) {
						peerCanAddPeers = true;
						break;
					}
				}
				// can we do an insert, or add as a peer
				if (_controlTypes[pasteControl.type].canUserInsert && (_controlTypes[_copyControl.type].canUserAdd || childCanAddPeers)) {
					// create the new control and place in child collection of current parent
					var newControl = doPaste(_copyControl, pasteControl);
					// add to childControl collection of current parent
					pasteControl.childControls.push(newControl);
					// move the html to the right place
					pasteControl.object.append(newControl.object);
				} else if (_controlTypes[_copyControl.type].canUserAdd || peerCanAddPeers) {
					// create the new control as peer of current selection
					var newControl = doPaste(_copyControl, pasteControl._parent);
					// use the insert right routine if we've got one
					if (newControl._insertRight) {
						newControl._insertRight();
					} else {						
						// move the object (if the parent isn't the page)
						if (pasteControl._parent._parent) newControl.object.insertAfter(pasteControl.object);
						// add it to the parent at the correct position
						pasteControl._parent.childControls.splice(pasteControl.object.index()+1,0,newControl);
					}
					// select the new one
					selectControl(newControl);				
				}					
				
			} else {
								
				if (_copyControl._parent && _controlTypes[_copyControl.type].canUserAdd) {
					// create the new control and place in child collection of current parent
					var newControl = doPaste(_copyControl, pasteControl);
					// add to childControl collection of current parent (which is the page)
					pasteControl.childControls.push(newControl);
					// select the new control
					selectControl(newControl);
				} else {
					// create the new page control with paste
					var newControl = doPaste(_copyControl);
					// select the new control
					selectControl(newControl);
				} // page copy check
				
			} // page paste check
			
			// rebuild the page map
			buildPageMap();
					
		}		
	});		
	
	// properties header toggle
	$("#propertiesHeader").click( toggleHeader );
	
	// keyboard short-cuts
	$(window).on('keydown', function(ev) {
		var t = $(ev.target);
		if (event.ctrlKey || event.metaKey) {
	        switch (String.fromCharCode(ev.which).toLowerCase()) {
	        case 's':
	            ev.preventDefault();
	            $("#pageSave").click();
	            break;
	        case 'z':
	            ev.preventDefault();
	            if (ev.shiftKey) {
	            	$("#redo").click();
	            } else {
	            	$("#undo").click();
	            }
	            break;
	        case 'c':
	        	if (t.is("body")) {
		            ev.preventDefault();
		            if (_selectedControl) $("#copy").click();
	        	}
	            break;
	        case 'v':
	        	if (t.is("body")) {
		            ev.preventDefault();
		            if (_copyControl) $("#paste").click();
	        	}
	            break;
	        }
	    }
	});
							
});

//reusable function for when there is a mousedown on the cover or selection box
function coverMouseDown(ev) {
	
	// remember that the mouse is down
	_mouseDown = true;
	// hide the control panel (sometimes it's mouseout isn't hit)
	if (!_panelPinned) hideControlPanel();
	// if there is a selected control with unapplied styles, apply now before wiping everything out
	if (_selectedControl && !_stylesApplied) applyStyles();
	// get the control under the mouse X/Y
	var c = getMouseControl(ev);
	// if we got one
	if (c) {		
		// retain reference to the selected object
		_selectedControl = c;									
		// stop mousemove if canMove is not a property of the control class
		if (!_controlTypes[_selectedControl.type].canUserMove) _mouseDown = false;
		// fire the mousedown event for the object
		c.object.trigger("mousedown", ev);			
		// select control
		selectControl(c);
		// calculate the mouse offsets, for moving later, note the adding page of the pinned Offset as we removed it when calling the object event
		_mouseDownXOffset = _selectedControl.object.offset().left - ev.pageX;
		_mouseDownYOffset = _selectedControl.object.offset().top - ev.pageY;
	} else { 
		// not got an object if there are no child controls on the page select it, otherwise clear everything
		if (_page.childControls && _page.childControls.length == 0 && !$("#propertiesPanel").is(":visible") ) {
			// select the page
			selectControl(_page);
		} else {
			// select a null control (this does a lot of cleanup)
			selectControl(null);				
		}
		// hide the select border
		_selectionBorder.hide();			
	}				
	
}

// stop controls being inserted into their pass children for example pass a table cell and a table
function isDecendant(control1, control2) {	
	var result = false;
	if (control1 === control2) {
		result = true;
	} else {
		if (control1 && control2 && control1.childControls) {
			for (var i in control1.childControls) {
				var c = control1.childControls[i];
				result = isDecendant(c, control2);
				if (result) break;
			}
		}	
	}		
	return result;
}

// size the controls list box (used when resizing control panel and starting / loading versions)
function sizeControlsList(width) {
	// check if a width was provided
	if (width) {
		// set the new width 
		$("#controlPanel").css("width", width);
	} else {
		// read in the current width
		width = parseInt($("#controlPanel").css("width"));
	}
	// size the inner
	$("#controlPanelInner").css("width",width);
	// get the controls list
	var controlsList = $("#controlsList");
	// get the number of children
	var controls = controlsList.children().size();
	// get the controls wide
	var controlsWidth = Math.floor(width / 39);
	// get the controls high
	var controlsHigh = Math.ceil(controls / controlsWidth);		
	// set the fixed height and margin (to allow animation and center controls)
	controlsList.css({
		"padding-left" : (width - controlsWidth * 39) / 2,
		"height" :  controlsHigh * 36
	});	
}

//if the mouse moves anywhere
$(document).on("mousemove touchmove", function(ev) {
	
	if (_controlPanelSize) {
	
		// get the control panel
		var panel = $("#controlPanel");
		// get the min-width
		var minWidth = parseInt(panel.css("min-width"));
		// calculate the new width less offset and padding
		var width = ev.pageX - _mouseDownXOffset;
		// if width is between max and min
		if (width >= minWidth && width < _window.width() - _scrollBarWidth - 21) {
			// size the controls list
			sizeControlsList(width);
			// retain this width in the sizes object
			_sizes["controlPanelWidth"] = width;
		}
				
	} else if (_propertiesPanelSize) {
	
		// get the control panel
		var panel = $("#propertiesPanel");
		// get the min-width
		var minWidth = parseInt(panel.css("min-width"));
		// calculate the new width less offset and padding
		var width = _window.width() - ev.pageX - 21 + _mouseDownXOffset;
		// if width is between max and min
		if (width >= minWidth && width <  _window.width() - _scrollBarWidth - 21) {
			// size the properties panel
			panel.css("width", width);
			// size the inner panel
			$("#propertiesPanelInner").width(width);
			// retain this width in the sizes object
			_sizes["propertiesPanelWidth"] = width;
		}
				
	} else if (_dialogueSize) {
		
		// get the dialogue
		var dialogue = $("#" + _dialogueSizeId);
		// get the min-width
		var minWidth = parseInt(dialogue.css("min-width"));
		// calculate the new width less offset and padding
		var width = _window.width() - ev.pageX - 32 + _mouseDownXOffset;
		// if width is greater than min
		if (width >= minWidth) {
			// size the properties panel
			dialogue.css(	"width", width);
			// retain this width in the sizes object
			_sizes[_version.id + _version.version + _dialogueSizeId + "width"] = width;
		}
		
	} else {
		
		// get the target 
		var t = $(ev.target);
					
		// get a reference to the control
		var c = getMouseControl(ev);
		
		// if a control is selected and the mouse is down look for the controls new destination
		if (_selectedControl) {
			
			// check the mouse is down (and the selected control has an object)
			if (_mouseDown && _selectedControl.object[0]) {		
						
				// if we have just started moving position the cover
				if (!_movingControl) {
					
					var controlClass = _controlTypes[_selectedControl.type];
					
					// if it is not nonVisible
					if (controlClass.getHtmlFunction.indexOf("nonVisibleControl") < 0) {
					
						// position the object cover
						_selectionCover.css({
							"width": _selectedControl.object.outerWidth() * _scale, 
							"height": _selectedControl.object.outerHeight() * _scale, 
							"left": _selectedControl.object.offset().left + _panelPinnedOffset, 	
							"top": _selectedControl.object.offset().top - _pageIframeWindow.scrollTop()
						});
															
					}
					
					if (_selectedControl.object.is(":visible")) {
						// show it if selected object visible
						_selectionCover.show();				
						// show the insert
						_selectionInsert.show();				
					}			
					
					// hide the properties - this can cause the properties panel to bounce
					hidePropertiesPanel();
					
					// remember we are now moving an object
					_movingControl = true;
				
				} // just started moving
				
				// position the selection border
				positionBorder(ev.pageX + _panelPinnedOffset, ev.pageY - (_addedControl ? 0 : _pageIframeWindow.scrollTop()));
											
				// if we got a control and it's allowed to be moved by the user (non-visual controls can be added but not moved so this way they remain with their parent control as the page)
				if (c && _controlTypes[_selectedControl.type].canUserMove ) {
					// retain a reference to the movedoverObject
					_movedoverControl = c;
					// position the insert cover
					_selectionInsertCover.css({
						"width": _movedoverControl.object.outerWidth() * _scale, 
						"height": _movedoverControl.object.outerHeight() * _scale, 
						"left": _movedoverControl.object.offset().left + _panelPinnedOffset, 	
						"top": _movedoverControl.object.offset().top - _pageIframeWindow.scrollTop()
					});
					// calculate the width
					var width =  _movedoverControl.object.outerWidth() * _scale;
					// if over the selected object or a descendant don't show anything
					if (_movedoverControl === _selectedControl || isDecendant(_selectedControl,_movedoverControl)) {
						_selectionInsert.hide();
						_selectionInsertCover.hide();
						_selectionMoveLeft.hide();
						_selectionMoveRight.hide();
					} else {			
						_selectionInsertCover.show();
						// calculate a move threshold which is the number of pixels to the left or right of the object the users needs to be within
						var moveThreshold = Math.min(50 * _scale, width/3);
						// if it's not possible to insert make the move thresholds half the width to cover the full object
						if (!_controlTypes[_movedoverControl.type].canUserInsert) moveThreshold = width/2;
						// are we within the move threshold on the left or the right controls that can be moved, or in the middle with an addChildControl method?
						if (_controlTypes[_movedoverControl.type].canUserMove && ev.pageX - _panelPinnedOffset < _movedoverControl.object.offset().left + moveThreshold) {
							// position the insert left
							_selectionMoveLeft.css({
								"display": "block",
								"left": _panelPinnedOffset + _movedoverControl.object.offset().left,	
								"top": ev.pageY - _selectionInsert.outerHeight()/2
							});
							// remember it's on the left
							_movedoverDirection = "L";
							// make sure the other selections are hidden	
							_selectionMoveRight.hide();
							_selectionInsert.hide();
						} else if (_controlTypes[_movedoverControl.type].canUserMove && ev.pageX - _panelPinnedOffset > _movedoverControl.object.offset().left + width - moveThreshold) {
							// position the insert right
							_selectionMoveRight.css({
								"display": "block",
								"left": _panelPinnedOffset + _movedoverControl.object.offset().left + width - _selectionMoveRight.outerWidth(),	
								"top":ev.pageY - _selectionInsert.outerHeight()/2
							});
							// remember it's on the right
							_movedoverDirection = "R";
							// make sure the other selections are hidden		
							_selectionMoveLeft.hide();
							_selectionInsert.hide();
						} else if (_controlTypes[_movedoverControl.type].canUserInsert) {
							// position the insert in the middle
							_selectionInsert.css({
								"display": "block",
								"left": _panelPinnedOffset + _movedoverControl.object.offset().left + (width - _selectionInsert.outerWidth())/2,	
								"top":ev.pageY - _selectionInsert.outerHeight()
							});
							// remember it's in the the centre
							_movedoverDirection = "C";
							// make sure the other selections are hidden					
							_selectionMoveLeft.hide();
							_selectionMoveRight.hide();
						} else {
							// null and hide all selection goodies
							_selectionInsert.hide();
							_selectionInsertCover.hide();
							_movedoverDirection = null;
							_selectionMoveLeft.hide();
							_selectionMoveRight.hide();
						}									
					}
				} // if over object		
			} // if mouse down
		}; // if selectedObject						
	}
	
}); // mousemove

// if the mouse is upped anywhere
$(document).on("mouseup touchend", function(ev) {
	
	_mouseDown = false;
	_mouseDownXOffset = 0;
	_mouseDownYOffset = 0;	
	_addedControl = false;
	_reorderDetails = null;
	_propertiesPanelSize = false;
	_dialogueSize = false;
	
	if (_controlPanelSize) {
		
		// only if the panel is pinned
		if (_panelPinnedOffset > 0) {
			// set the latest panel pinned offset (plus padding and border)
			_panelPinnedOffset = $("#controlPanel").width() + 21;
			// size the window
			windowResize("controlPanelSize");			
		}
		// set to false
		_controlPanelSize = false;
		// arrange controls as  the left reference has changed
		arrangeNonVisibleControls();
		
	} else if (_selectedControl && _selectedControl.object[0]) {		
		
		// show it in case it was an add
		if (_controlTypes[_selectedControl.type].canUserAdd) _selectedControl.object.show();
		// if we were moving a control different from the _selectedControl
		if (_movingControl && _movedoverControl && _movedoverDirection && _movedoverControl.object[0] !== _selectedControl.object[0]) {			
			// add an undo snapshot for the whole page 
			addUndo(true);
			// remove the object from it's current parent
			removeControlFromParent(_selectedControl);			
			// move the selectedObject to the left or right of the movedoverObject, or insert if in the centre
			switch (_movedoverDirection) {
			case "L" : 
				// retain the same parent control as the moved over control
				_selectedControl._parent = _movedoverControl._parent;
				// move the markup object before the moved over object
				_selectedControl.object.insertBefore(_movedoverControl.object);
				// add to childControls at correct position
				_movedoverControl._parent.childControls.splice(_movedoverControl.object.index()-1,0,_selectedControl);				
				break;		
			case "R" :				
				// retain the same parent control as the moved over control
				_selectedControl._parent = _movedoverControl._parent;
				// move the markup object after the moved over object
				_selectedControl.object.insertAfter(_movedoverControl.object);
				// add to childControls at correct position
				_movedoverControl._parent.childControls.splice(_movedoverControl.object.index()+1,0,_selectedControl);								
				break;	
			case "C" :
				// assign the correct parent
				_selectedControl._parent = _movedoverControl;
				// add the selected control into the moved over control  
				_movedoverControl.childControls.push(_selectedControl);				
				// move the object into the right place
				_movedoverControl.object.append(_selectedControl.object);
				break;
			}				
			// rebuild the page map
			buildPageMap();
		}
		
		// remember we have only selected (no longer moving)
		selectedState = 1;
		// null the moveedoverObject
		_movedoverControl = null;
		// hide the cover
		_selectionCover.hide();
		// hide the insert/moves
		_selectionInsert.hide();
		// hide the insert cover
		_selectionInsertCover.hide();
		_selectionMoveLeft.hide();
		_selectionMoveRight.hide();	
		// size and position the border in case moving it has changed it's geometery
		positionAndSizeBorder(_selectedControl);		
		// show the properties panel			
		showPropertiesPanel();
		// show a normal cursor
		$("body").css("cursor","");
		// allow text selection in the document again
		$("body").css({
			"-webkit-touch-callout":"",
			"-webkit-user-select":"",
			"-khtml-user-select":"",
			"-moz-user-select":"",
			"-ms-user-select":"",
			"user-select":""
		});
	}; // if selectedObject
	_movingControl = false;	
}); // mouseup

// called whenever a control is added or deleted in case one was a non-visible control and needs rearranging
function arrangeNonVisibleControls() {	
	// check there is a page and a page object
	if (_page && _page.object && _page.childControls) {
				
		// start at first x position
		var x = _panelPinnedOffset + 10;
		
		// loop the page child controls
		for (var i in _page.childControls) {
			
			// get the child control
			var childControl = _page.childControls[i];
			// get the class
			var childControlClass = _controlTypes[childControl.type];
			
			// if it is nonVisible
			if (childControlClass.getHtmlFunction.indexOf("nonVisibleControl") > 0) {
				
				// get the object
				var	o = childControl.object;
				
				// check if in the page
				if (o.parent().is(_page.object)) {
					// move into the designer and update the reference
					o = $("body").append(o).children().last();
					// add back to the control
					childControl.object = o;
				} 
				
				// ensure the object is visible
				o.show();
				// ensure the object is in the right place
				o.css({"position":"fixed","bottom":"10px","left":x});
				// get the width
				var w = Math.max(o.outerWidth(),25);
				// add to the growing x value
				x += (5 + w);
				
			}
		}		
	}	
}

// this gets the working height from the max of the control panel, iframe, properties panel, and screen 
function getHeight() {
		
	// get the window height
	var height = _window.height();
				
	// get the control panel
	var controlPanel = $("#controlPanel");
		
	// get the properties panel
	var propertiesPanel = $("#propertiesPanel");
			
	// get its current height (less the combined top and bottom padding)
	var controlPanelHeight = controlPanel.outerHeight(true);
		
	// get its current height
	var propertiesPanelHeight = propertiesPanel.outerHeight(true);
	
	// get the iFrame height by it's contents
	var iframeHeight = $(_pageIframe[0].contentDocument).height();
	
	// get the device
	var device = _devices[_device];
	
	// if there is a device with height use this scaled height instead of the iframe content
	if (device.height) iframeHeight = device.height * _scale / device.scale + _scrollBarWidth;

	// increase height to the tallest of the window, the panels, or the iFrame
	height = Math.max(height, controlPanelHeight, propertiesPanelHeight, iframeHeight);
			
	return height;
	
}

// this makes sure the properties panel is visible and tall enough for all properties
function showPropertiesPanel() {
	
	// set all controls to readonly if the page is locked
	if (_locked) {		
		// get the properties panel to include actions and styles
		var propertiesPanel = $("#propertiesPanel");
		// get the dialogues
		var propertiesDialogues = $("#propertiesDialogues");
		// disable inputs
		propertiesPanel.find("input").attr("disabled","disabled");
		propertiesDialogues.find("input").attr("disabled","disabled");
		// disable drop downs
		propertiesPanel.find("select").attr("disabled","disabled");
		propertiesDialogues.find("select").attr("disabled","disabled");
		// readonly textareas
		propertiesPanel.find("textarea").attr("readonly","readonly");
		propertiesDialogues.find("textarea").attr("readonly","readonly");
		// disable deletes
		propertiesPanel.find("img").off("click");
		propertiesDialogues.find("img").off("click");	
		// disable order moves
		propertiesPanel.find("img").off("mousedown");
		propertiesDialogues.find("img").off("mousedown");
	}
		
	// size the panel (less padding) and show - note the .stop(true, true) which clears any current animation queue and sets the final settings immediately 
	$("#propertiesPanel").css("height",getHeight() - 20).stop(true, true).show("slide", {direction: "right"}, 200, function(){
		// show the inner 
		$("#propertiesPanelInner").show()
	});
					
}

function hideControlPanel(resetOffset) {
	// slide the control panel
	$("#controlPanel").stop(true, true).hide("slide", {direction: "left"}, 200, function() {
		// hide the inner
		$("#controlPanelInner").hide();
		// set the panel pin offset
		if (resetOffset) _panelPinnedOffset = 0;
		// resize the window
		windowResize("pin");		
	});
	// hide the inner
	$("#controlPanelInner").hide();
}

function hidePropertiesPanel() {
	
	// hide the inner
	$("#propertiesPanelInner").hide();
	// slide in the panel - note the .stop(true, true) which clears any current animation queue and sets the final settings immediately 
	$("#propertiesPanel").stop(true, true).hide("slide", {direction: "right"}, 200);
}

// called whenever the page is resized
function windowResize(ev) {
	
	// get the caller of this function
	var caller = ev.data || ev;
	
	// get the window width
	var width = _window.width();
		
	// get the current scroll position
	var scrollTop = _window.scrollTop();
	
	// get the control panel
	var controlPanel = $("#controlPanel");		
	// set it's height to auto
	controlPanel.css("height","auto");
	
	// get the properties panel
	var propertiesPanel = $("#propertiesPanel");
	// set it's height to auto
	propertiesPanel.css("height","auto");
	
	// use the function to get our working height
	var height = getHeight();
				
	// adjust controlPanel height, less it's padding
	controlPanel.css({height: height - 20});
	
	// adjust propertiesPanel height, less it's padding
	propertiesPanel.css({height: height - 20});
			
	// get the device
	var device = _devices[_device];
	
	// only if we have a page and it's object
	if (_page && _page.object) {
		// if the scale is 1 remove anything clever
		if (_scale * device.scale == 1) {
			_page.object.css({
				width: "auto",
				height: "auto",
				transform: "none",
				"transform-origin": "initial"
			});
		} else {
			// the page scale needs ajusting when there is a page margin
			// adjust the page scale
			_page.object.css({
				width: 1 / _scale * 100 + "%",
				height: 1 / _scale * 100 + "%",
				transform: "scale(" + _scale + ")",	
				"transform-origin": "0 0"
			});	
		} // scale check
	} // page check	
	
	// if the device has a height, or we're scalling
	if (device.height) {
		
		// get the width and heigth from the device and scale
		var devWidth = device.width * _scale / device.scale;
		var devHeight = device.height * _scale / device.scale;
		// if landscape swap width and height
		if (_orientation == "L") {
			var tempHeight = devHeight;
			devHeight = devWidth;
			devWidth = tempHeight;
		} 		
		// adjust iframe position width and height, to default scalled width and height, allowing extra if scroll bars are required
		_pageIframe.css({
			left: _panelPinnedOffset,
			width: devWidth,
			height: devHeight
		});			
		// adjust the cover
		_designCover.css({
			position: "absolute",
			top: 0,
			left: _panelPinnedOffset,
			right: "auto",
			bottom: "auto",			
			width: devWidth,
			height: devHeight
		});						
		// position the desktop covers
		$("#desktopCoverBottom").css({
			height: height - devHeight - 1,
			width: width,
			top: devHeight + 1
		}).show();		
		$("#desktopCoverRight").css({
			height: height,
			width: width - devWidth - 1 - _panelPinnedOffset,
			left: _panelPinnedOffset + devWidth + 1
		}).show();
		
		// give the iframe resize time to apply
    	window.setTimeout( function() {
    		
    		// assume no v scrollling
    		var scrollV = false;
    		// assume no h scrolling
    		var scrollH = false;
    		
    		// get the iframe body
    		var iframeBody = $(_pageIframe[0].contentDocument).find("body");
    		
    		// measure the height of the iframe body contents
    		var contentHeight = iframeBody[0].scrollHeight - (parseInt(iframeBody.css("margin-top")) + parseInt(iframeBody.css("margin-bottom")) + parseInt(iframeBody.css("padding-top")) + parseInt(iframeBody.css("padding-bottom")));
    		// measure the width of the iframe body contents
    		var contentWidth = iframeBody[0].scrollWidth - (parseInt(iframeBody.css("margin-left")) + parseInt(iframeBody.css("margin-right")) + parseInt(iframeBody.css("padding-left")) + parseInt(iframeBody.css("padding-right")));
    		    		    		    	
    		// if the contents are taller than the device height we need vertical scrolling
    		if (contentHeight > Math.round(devHeight)) {
	    		// set the scroll bar height to the content height
	    		$("#scrollVInner").css("height", contentHeight);    		    		
	    		// show and position the scroll bars
	    		$("#scrollV").css({
	    			display: "block",
	    			left: _panelPinnedOffset + devWidth + 1,
	    			height: devHeight + 1 + _scrollBarWidth
	    		});
	    		// remember V is showing
	    		scrollV = true;
	    		// trigger a scroll to ensure contents are in sync
	    		$("#scrollV").scroll();
    		} else {
    			$("#scrollV").hide();
    		}
    		
    		// if the contents are wider than the device width we need horizontal scrolling
    		if (contentWidth > Math.round(devWidth)) {
    			// set the scroll bar width
    			$("#scrollHInner").css("width", contentWidth);
    			// show and position the scroll bar
	    		$("#scrollH").css({
	    			display: "block",
	    			left: _panelPinnedOffset,
	    			top: devHeight + 1,
	    			width: devWidth + 1 + _scrollBarWidth			
	    		});	    	
	    		// remember H is showing
	    		scrollH = true;
	    		// trigger a scroll to ensure contents are in sync
	    		$("#scrollH").scroll();
    		}  else {
    			$("#scrollH").hide();
    		}
    		
    		// if both scrolls push back covers
    		if (scrollV && scrollH) {
    			$("#desktopCoverRight").css("z-index",10005);
    			$("#desktopCoverBottom").css("z-index",10005);
    		} else {
    			// if just V cover H with bottom
    			if (scrollV) $("#desktopCoverBottom").css("z-index",10006);
    			// if just H cover V with right
    			if (scrollH) $("#desktopCoverRight").css("z-index",10006);
    		}
    		
    		// check properties panel position, the iframe may be jutting out of the body
    		if (_panelPinnedOffset + devWidth + 1 > width) {
    			$("#propertiesPanel").css("right", -$("body")[0].scrollWidth + width - _scrollBarWidth);
    		} else {
    			$("#propertiesPanel").css("right", 0);
    		}
    		
    	}, 500);
		
	} else {
		// adjust iframe position, width and height
		_pageIframe.css({
			left: _panelPinnedOffset,
			width: width - _panelPinnedOffset - 1,
			height: height 
		});
		// adjust the cover to be full-screen
		_designCover.css({
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			width: "auto",
			height: "auto"
		});
		// hide the scroll bars
		$("#scrollV").hide();
		$("#scrollV").hide();
		// hide the desktop covers
		$(".desktopCover").hide();				
	}
					
	// get the control inner
	var cinner = $("#controlPanelInner");
	// if height is less than window
	if (cinner.height() < _window.height()) {
		// fix the position and set the width
		cinner.css({
			"position":"fixed",
			"width": $("#controlPanel").width()
			});
		// reset pin
		$("#controlPanelPin").css({"top":"0", "right":"0"});
	} else {
		// set it to the default, static, so it scrolls
		cinner.css("position","static");
		// adjust pin
		$("#controlPanelPin").css({"top":controlPanel.css("padding-top"), "right":controlPanel.css("padding-right")});
	}
	
	// get the properties inner
	var pinner = $("#propertiesPanelInner");
	// if height is less than window
	if (pinner.height() < _window.height()) {
		// fix the position and set the width
		pinner.css({
			"position":"fixed",
			"width": $("#propertiesPanel").width()
			});
		// reset pin
		$("#propertiesPanelPin").css({"top":controlPanel.css("padding-top"), "left":"0"});
	} else {
		// set it to the default, static, so it scrolls
		pinner.css("position","static");
		// adjust pin - note that the height is matched to the padding on the control panel as properties has no padding top and we want pins on the same level
		$("#propertiesPanelPin").css({"top":controlPanel.css("padding-top"), "left":propertiesPanel.css("padding-left")});
	}
	
	// resize / reposition the selection
	positionAndSizeBorder(_selectedControl);
	
}

function fileuploaded(fileuploadframe) {

    var f = window.frames["uploadIFrame"];
    if (!f) f = document.getElementById("uploadIFrame").contentDocument;

    var r = $(f.document.body).text();

    if ((r) && (r != "")) {
    	
    	if (r.indexOf("Error") == 0) {
    		
    		alert(r);
    		
    	} else {
    		
    		var response = JSON.parse(r);
        	
        	switch (response.type) {
        	case "uploadImage" :
        		// update file property in control
        		_selectedControl.file = response.file;
        		// init the images array if need be
        		if (!_version.images) _version.images = [];
        		// add to array
        		_version.images.push(response.file);
        		// rebuild html
        		rebuildHtml(_selectedControl);        	
        		// all some time for the page to load in the image before re-establishing the selection border
            	window.setTimeout( function() {
            		// show the dialogue
            		positionAndSizeBorder(_selectedControl);        
            		// resize the window and check for any required scroll bars
            		windowResize("fileuploaded");
            	}, 200);
        	}
    		
    	}
    	
    }

}
