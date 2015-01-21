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

package com.rapid.utils;

import javax.xml.bind.annotation.adapters.XmlAdapter;

public class JAXB {
	
	public static class EncryptedXmlAdapter extends XmlAdapter<String, String> {
		
		private char[] _password;
		private byte[] _salt;
		
		public EncryptedXmlAdapter(char[] password, byte[] salt) {
			_password = password;			
			_salt = salt;		
		}
		
	    @Override
	    public String unmarshal(String s) {
	        try {
	        	if (s == null) {
	        		return null;
	        	} else if (_password == null || _salt == null) {
	        		return s;
	        	} else {
	        		return Encryption.decrypt(s, _password, _salt);
	        	}
			} catch (Exception ex) {
				return s;
			}
			
	    }

	    @Override
	    public String marshal(String s) {
	        try {
	        	if (s == null) {
	        		return null;
	        	} else if (_password == null || _salt == null) {
	        		return s;
	        	} else {
	        		return Encryption.encrypt(s, _password, _salt);
	        	}
			} catch (Exception ex) {
				return s;
			}
	    }
	}

}
