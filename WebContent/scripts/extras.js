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

// extend String to have a trim function for IE8
if (typeof String.prototype.trim !== 'function') {
	String.prototype.trim = function() {
		return this.replace(/^\s+|\s+$/g, ''); 
	};
}

// extend String to have a replaceAll function
String.prototype.replaceAll = function( find, replace ) {
    return this.split( find ).join( replace );        
};

// extend JQuery to have functions for retreiving url parameter values
$.extend({
  getUrlVars: function(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      if (hash[1]) vars[hash[0]] = decodeURIComponent(hash[1].replace('#',''));
    }
    return vars;
  },
  getUrlVar: function(name){
    return $.getUrlVars()[name];
  }
});

// extend JQuery object methods
$.fn.extend({
  enable: function() {
    this.removeAttr("disabled");
    return this;
  },
  disable: function() {
	this.attr("disabled","disabled");
    return this;
  },
  showLoading: function() {
	var loadingCover = $("div[data-id=" + this.attr("id") + "]");
	if (!loadingCover[0]) {
		this.after("<div class='loading' data-id='" + this.attr("id") + "'></div><span class='loading' data-id='" + this.attr("id") + "'></span>");
		loadingCover = $("div[data-id=" + this.attr("id") + "]");
	}				
	loadingCover.css({
		left: this.offset().left,
		top: this.offset().top,
		width: this.outerWidth(),
		height: this.outerHeight()
	}).show();
	if (this.outerWidth() > 0) {
		var image = loadingCover.next();
		image.css({
			left: this.offset().left + (this.outerWidth() - image.outerWidth())/2,
			top: this.offset().top + (this.outerHeight() - image.outerHeight())/2
		}).show();
	}	
    return this;
  },
  hideLoading: function() {
	$("body").find("div[data-id=" + this.attr("id") + "]").hide().next().hide();	
    return this;
  },
  hideDialogue: function(reload) {	  
	  var dialogue = $(this).closest("div.dialogue");	  
	  dialogue.prev("div.dialogueCover").remove();
	  dialogue.remove(); 
	  if (reload) {
		  var pageId = $("body").attr("id");
		  if (window["Event_pageload_" + pageId]) window["Event_pageload_" + pageId]();		  
	  }
	  
  }
});

/*
 
 http://code.accursoft.com/caret
 
 Copyright (c) 2009, Gideon Sireling

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials provided
      with the distribution.

    * Neither the name of Gideon Sireling nor the names of other
      contributors may be used to endorse or promote products derived
      from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 */
(function($) {
  $.fn.caret = function(pos) {
    var target = this[0];
	var isContentEditable = target.contentEditable === 'true';
    //get
    if (arguments.length == 0) {
      //HTML5
      if (window.getSelection) {
        //contenteditable
        if (isContentEditable) {
          target.focus();
          var range1 = window.getSelection().getRangeAt(0),
              range2 = range1.cloneRange();
          range2.selectNodeContents(target);
          range2.setEnd(range1.endContainer, range1.endOffset);
          return range2.toString().length;
        }
        //textarea
        return target.selectionStart;
      }
      //IE<9
      if (document.selection) {
        target.focus();
        //contenteditable
        if (isContentEditable) {
            var range1 = document.selection.createRange(),
                range2 = document.body.createTextRange();
            range2.moveToElementText(target);
            range2.setEndPoint('EndToEnd', range1);
            return range2.text.length;
        }
        //textarea
        var pos = 0,
            range = target.createTextRange(),
            range2 = document.selection.createRange().duplicate(),
            bookmark = range2.getBookmark();
        range.moveToBookmark(bookmark);
        while (range.moveStart('character', -1) !== 0) pos++;
        return pos;
      }
      //not supported
      return 0;
    }
    //set
    if (pos == -1)
      pos = this[isContentEditable? 'text' : 'val']().length;
    //HTML5
    if (window.getSelection) {
      //contenteditable
      if (isContentEditable) {
        target.focus();
        window.getSelection().collapse(target.firstChild, pos);
      }
      //textarea
      else
        target.setSelectionRange(pos, pos);
    }
    //IE<9
    else if (document.body.createTextRange) {
      var range = document.body.createTextRange();
      range.moveToElementText(target)
      range.moveStart('character', pos);
      range.collapse(true);
      range.select();
    }
    if (!isContentEditable)
      target.focus();
    return pos;
  }
})(jQuery)

//this applies and enforces the maxlength attribute on textareas
jQuery(function($) {

  // ignore these keys
  var ignore = [8,9,13,33,34,35,36,37,38,39,40,46];

  // use keypress instead of keydown as that's the only
  // place keystrokes could be canceled in Opera
  var eventName = 'keypress';

  // handle textareas with maxlength attribute
  $('textarea[maxlength]')

    // this is where the magic happens
    .on(eventName, function(event) {
      var self = $(this),
          maxlength = self.attr('maxlength'),
          code = $.data(this, 'keycode');

      // check if maxlength has a value.
      // The value must be greater than 0
      if (maxlength && maxlength > 0) {

        // continue with this keystroke if maxlength
        // not reached or one of the ignored keys were pressed.
        return ( self.val().length < maxlength || $.inArray(code, ignore) !== -1 );

      }
    })

    // store keyCode from keydown event for later use
    .on('keydown', function(event) {
      $.data(this, 'keycode', event.keyCode || event.which);
    });

});

// override the much-used ajax call for both normal and Rapid Mobile 
if (window["_rapidmobile"]) {
	
	console.log("Rapid Mobile detected");
	
	// retain the original JQuery ajax function
	var ajax = $.ajax;
	
	// override it
	$.ajax = function(settings) {
		// the shouldInterceptRequest method only works for GET, so if there is data add it to the url
		if (settings.data) {
			// add data to the url
			settings.url += "&data=" + encodeURIComponent(settings.data);
			// remove it from the body
			settings.data = null;
		}
		// retain the original success function
		var success = settings.success;
		// override it
		settings.success = function(data, textStatus, jqXHR) {
			// if there is a json object in the response
			if (jqXHR.responseJSON) {
				// if it contains an error object
				if (jqXHR.responseJSON.error) {					
					// get the error object
					var error = jqXHR.responseJSON.error;
					// check the status code
					switch (error.status) {
					case (401) :
						// the user failed authentication show them a message in the ui
						_rapidmobile.showMessage(error.responseText);
						// bail
						return false;
					default :
						// run the error function
						settings.error(error, error.status, error.responseText);
						// bail
						return false;
					}					
				}
			}
			// run the original function if all good
			success(data, textStatus, jqXHR);
		}
		// now run the original ajax with our modified settings
		ajax(settings);
	}
		
	// get page html function for saving
	$.getSaveHtml = function() {
		// explicity push each input val in as an attribute
		$('input').each(function(){
			$(this).attr('value', $(this).val());
		});
		// return the page html 
		return "<!DOCTYPE html><html>" + $('html').html() + "</html>";
	}
	
} else {
	
	// retain the original JQuery ajax function
	var ajax = $.ajax;
	// substitute our own
	$.ajax = function(url, settings) {
		// retain original error handler
		var error = url.error;
		// override error
		url.error = function(jqXHR, textStatus, errorThrown) {
			// if this is a 401 (unauthorised) redirect the user to the login page and set requestApp so we'll come straight back
			if (jqXHR.status == 401) {
				// start with a basic login page url
				var location = "login.jsp";
				// if we're viewing an app we want to go back to it once logged in
				if (window.location.href.indexOf("/~?a=") > -1) {
					// look for an application parameter
					var appId = $.getUrlVar("a");
					// append escaped requestPath if there's an app
					if (appId) location += "?requestApp=" + appId;
				}				
				// redirect to login page
				window.location = location;
			} else {
				// call the original error
				error(jqXHR, textStatus, errorThrown);
			}
		}
		// call the original
		ajax(url, settings);
	}
}


function showValidationMessage(controlId, message) {
	var control = $("#" + controlId);
	control.addClass("validation");
	var element = control.next("div.validation")[0];
	if (element) {
		$(element).html(message);
	} else {
		control.after("<div class='validation'>" + message + "</div>");
	}
}

function hideValidationMessage(controlId) {
	var control = $("#" + controlId);
	control.removeClass("validation");
	control.next("div.validation").remove();
}

function makeDataObject(data, field) {
	// return immediately if all well (we have rows and fields already and there is nothing to promote)
	if (data.rows && data.fields && !(field && data[field])) return data;		
	// initialise fields
	var fields = [];
	// initialise rows
	var rows = [];
	// initialise a fieldmap (as properties aren't always in the same position each time)
	var fieldMap = [];
	// if the field is what we're after move it into the data
	if (field && data[field]) data = data[field];
	// if the data is an array
	if ($.isArray(data)) {
		// loop the array
		for (var i in data) {
			// retrieve the item
			var item = data[i];
			// prepare a row
			var row = [];
			// if it's an object build data object from it's properties
			if ($.isPlainObject(item)) {				
				var fieldPos = 0;				
				for (var j in item) {
					// check for a field mapping				 
					if (fieldMap[fieldPos]) {
						// if the mapping is different 
						if (fieldMap[fieldPos] != j) {						
							// assume field isn't there
							fieldPos = -1;
							for (var k in fieldMap) {
								if (j == fieldMap[k]) {
									fieldPos =k;
									break;
								}
							}
							// field pos wasn't found
							if (fieldPos == -1) {
								fieldMap.push(j);
								fields.push(j);
								fieldPos = fields.length - 1;
							}
						}
					} else {
						// we don't have a mapping for this field (this is good, store field at this position in map and fields array)
						fieldMap.push(j);
						fields.push(j);
						fieldPos = fields.length - 1;
					}
					// store the data in the row at the field position 
					row[fieldPos] = item[j];
					// all being well the next property is in the next position, if it wraps it'll assume it's an unseen field
					if (fieldPos < fields.length - 1) fieldPos++;
				}								
			} else {
				// retain the field
				if (i == 0) fields.push(field);
				// make a row with the item
				row = [ item ];
			}
			// add the row
			rows.push(row);
		}				
	} else {
		var row = [];
		if ($.isPlainObject(data)) {
			for (var i in data) {
				fields.push(i);
				row.push(data[i]);
			}
		} else {
			fields.push(field);
			row.push(data);
		}		
		rows.push(row);
	}
	data = { fields: fields, rows: rows};
	return data;
}

function mergeDataObjects(data1, data2) {
	var data = null;
	if (data1) {
		if (!data1.fields || !data1.rows) data1 = makeDataObject(data1);
		if (data2) {
			if (!data2.fields || !data2.rows) data2 = makeDataObject(data2);
			var fields = [];
			for (var i in data2.fields) fields.push(data2.fields[i]);
			for (var i in data1.fields) {
				var gotField = false;
				for (var j in fields) {
					if (data1.fields[i] == fields[j]) {
						gotField = true;
						break;
					}
				}
				if (!gotField) fields.push(data1.fields[i]);
			}
			data = {};
			data.fields = fields;
			data.rows = [];
			var totalRows = data1.rows.length;
			if (data2.rows.length > totalRows) totalRows = data2.rows.length;			
			for (var i = 0; i < totalRows; i++) {
				var row = [];
				for (var j in fields) {
					var value = null;
					if (i < data1.rows.length) {
						for (var k in data1.fields) {
							if (fields[j] == data1.fields[k]) {
								value = data1.rows[i][k];
								break;
							}
						}
					}
					if (i < data2.rows.length && value == null) {
						for (var k in data2.fields) {
							if (fields[j] == data2.fields[k]) {
								value = data2.rows[i][k];
								break;
							}
						}
					}
					row.push(value);
				}
				data.rows.push(row);
			}			
		} else {
			data = data1;
		}
	} else {
		data = data2;
	}
	return data;
}

//assume css values are in pixels but if em is recognised convert (other units to follow)
function toPixels(size) {
	if (size.indexOf("em") == size.length - 2) {
		var emSize = parseFloat($("body").css("font-size"));
	    return (emSize * parseFloat(size));
	} else {
		return parseFloat(size);
	}	
}
