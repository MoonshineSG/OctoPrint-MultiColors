$(function() {

  function multiColorViewModel(viewModels) {
	var self = this;

	self.loginState = viewModels[0];
	self.printer = viewModels[1];
	self.filesViewModel = viewModels[2];

	self.gcode = ko.observable();
	self.layers = ko.observable();
	self.message = ko.observable();
	self.enabled = ko.observable();
	self.find_string = ko.observable();
	self.duplicate = ko.observable();
	self.can_duplicate = ko.observable();

	self.NO_FILE = "First, select a GCODE file for printing...";
	self.NO_SD = "Injecting GCODE on SD card files not yet supported";
	
	self.onBeforeBinding = function () {
		self.isAdmin = viewModels[0].isAdmin;
		self.enabled(false);
		self.message(self.NO_FILE);
	}

	self._update = function(file_name){
		if (self.printer.isPrinting() || self.printer.isPaused() ) {
			self.message("Don't use this while printing...");
			self.enabled(false);
		} else {
			if (file_name != null) {
				self.filename = file_name;
				self.message( _.sprintf('Processing file "%(filename)s"...', {filename: self.filename}) );
				self.enabled(true);
				
				self.duplicate(JSON.parse(localStorage.getItem("multicolors.duplicate")));
				if ( file_name.substring(0, file_name.lastIndexOf('.')).endsWith("_multi") ) {
					self.can_duplicate(false);
					self.duplicate(false);
					self.message( _.sprintf('File "%(filename)s" already processed!! ', {filename: self.filename}) );
				} else {
					self.can_duplicate(true);
				}
			} else {
				self.message(self.NO_FILE);
				self.enabled(false);
			}
		}
	  }

	self.onTabChange = function(current, previous) {
		if (current == "#tab_plugin_multi_colors") {
			if ( self.printer.sd() ) {
				self.message(self.NO_SD);
			} else {
				self._update(self.printer.filepath());
			}
		}
	}

	self.onEventFileDeselected = function(payload) {
		self._update(null);
	}

	self.onAfterBinding = function(payload) {
		self.onTabChange("#tab_plugin_multi_colors", null);
		self._sendData({"command":"settings"}, function(data){ self.gcode(data.gcode); self.find_string(data.find_string)});
	}

	self.onEventFileSelected = function(payload) {
		if (payload.origin == "local") {
			self._update(payload.path);	
		} else {
			self.message(self.NO_SD);
		}
	}

	self._sendData = function(data, callback) {
		try {
			OctoPrint.postJson("api/plugin/multi_colors", data)
				.done(function(data) {
					if (callback) callback(data);
			});
		} catch(err) { //fallback to pre-devel version
			 $.ajax({
				 url: API_BASEURL + "plugin/multi_colors",
				 type: "POST",
				 dataType: "json",
				 timeout: 10000,
				 contentType: "application/json; charset=UTF-8",
				 data: JSON.stringify(data)
			}).done(function(data){if (typeof callback === "function") callback(data);});
		}
	};
	 
	self.changeLayers = function(){
		if (self.layers() == undefined || self.layers().trim() == "") {
			showMessageDialog({ title: "Layers please!", message: "Please enter at least on layer where the GCODe should be injected." });
			return;
		} 
		if (self.gcode() == undefined || self.gcode().trim() == "") {
			showMessageDialog({ title: "GCODE please!", message: "Please enter the GCODE to inject." });
			return;
		} 
		if (self.find_string() == undefined || self.find_string().trim() == "") {
			showMessageDialog({ title: "Regex please!", message: "Please enter a valid regex (advanced settings)." });
			return;
		} 
		if (self.can_duplicate()){
			localStorage.setItem("multicolors.duplicate", self.duplicate());
		}
		if ( ! self.duplicate() ) {
			showConfirmationDialog({
					message: gettext("This will insert additional gcode in your original file."),
					cancel: gettext("No"),
					proceed: gettext("Yes"),
					onproceed: function() {
						self.proceed();
				}
			});
		} else {
			self.proceed();
		}
	}
	
	self.proceed = function(){
		self._sendData({"command":"process", "duplicate":self.duplicate(), "file":self.filename, "gcode":self.gcode(), "layers":self.layers(),  "find_string":self.find_string().trim() }, 
			function(data){
				new PNotify({title:"Colors", text:data.message, type: data.status});
				self.filesViewModel.requestData({force:true});
	 			if (data.status != "error" && !self.duplicate()) {
					self.filesViewModel.loadFile({origin:"local", path:self.filename});
				}
			});
	}
}
	
	OCTOPRINT_VIEWMODELS.push([
		multiColorViewModel, 
		["loginStateViewModel", "printerStateViewModel", "filesViewModel", ],
		["#multi_color_layer"]
	]);
	  
});  