/*

Copyright (C) 2016 - Gareth Edwards / Rapid Information Systems

gareth.edwards@rapid-is.co.uk


This file is part of the Rapid Application Platform

Rapid is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as 
published by the Free Software Foundation, either version 3 of the 
License, or (at your option) any later version. The terms require you 
to include the original copyright, and the license notice in all redistributions.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
in a file named "COPYING".  If not, see <http://www.gnu.org/licenses/>.

*/

package com.rapid.core;

import org.json.JSONException;
import org.json.JSONObject;

public class Theme  {
	
	// private instance variables
	private String _type, _name, _css;
	private JSONObject _resources;

	// properties
	public String getType() { return _type; }
	public String getName() { return _name; }
	public String getCSS() { return _css; }
	public JSONObject getResources()  { return _resources; }

	// constructor
	public Theme(String xml) throws JSONException {		
		// convert the xml string into JSON
		JSONObject jsonTemplate = org.json.XML.toJSONObject(xml).getJSONObject("template");
		// retain properties
		_type = jsonTemplate.getString("type");
		_name = jsonTemplate.getString("name");
		_css = jsonTemplate.getString("css");
		_resources = jsonTemplate.optJSONObject("resources");
	}
	
}
