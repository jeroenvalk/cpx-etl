require('../../main').register(function(_) {
	var isName = function person$isName(val) {
		return /^\w+$/.test(val) && val.charAt(0).toUpperCase() === val.charAt(0) && val.substr(1).toLowerCase() === val.substr(1);
	};

	var findPersonByName = function person$findPersonByName(name) {
		return _.findOne({
			Person : {
				'@' : {
					where : {
						name : name
					}
				},
				Entity : {
					'@' : {
						where : {
							type : 'person'
						}
					}
				}
			}
		});
	};

	return {
		match : {
			_ : 'familyTree'
		},
		validation : {
			'_META.@type' : true,
			'_META.@force' : [ false, 'boolean' ],
			'@name' : isName,
			'@mother' : [ false, isName ],
			'@father' : [ false, isName ],
			'@type' : false
		},
		defaults : {
			'@type' : 'person'
		},
		extract : {
			'Entity.0.@ID' : {
				deps : [ '@name' ],
				$ : findPersonByName
			},
			'Entity.1.@ID' : {
				deps : [ '@mother' ],
				$ : findPersonByName
			},
			'Entity.2.@ID' : {
				deps : [ '@father' ],
				$ : findPersonByName
			},
			'@motherIsFemale' : {
				deps : [ 'Entity.1.@ID' ],
				$ : function(ID) {
					return _.findOne();
				}
			},
			'@fatherIsMale' : {
				deps : [ 'Entity.1.@ID' ],
				$ : function(ID) {
					return _.findOne();
				}
			}
		},
		transform : {
			'@name' : 'Entity.0.Person.@name',
			'@mother' : 'Entity.1.Person.@name',
			'@father' : 'Entity.2.Person.@name',
			'@type' : [ 'Entity.0.@type', 'Entity.1.@type', 'Entity.2.@type' ],
			'Entity.2.@ID' : [ 'Entity.2.Belonging.@minorID', 'Entity.2.Belonging.@majorID' ]
		},
		load : {
			Entity : {
				filter : function(entity) {
					return !entity['@ID'];
				},
				$ : function(entity) {
					return _.create({
						Entity : entity
					});
				},
				Person : {
					$ : function(person, entity) {
						return _.create({
							Person : _._.extend(person, {
								'@ID': entity['@ID']
							})
						});
					}
				},
				Belonging : {
					$ : function(belonging, entity) {
						return _.create({
							Belonging : _._.extend(belonging, {
								'@minorID': entity['@ID'],
								'@majorID': entity['@ID']
							})
						});
					}
				}
			}
		}
	};
});
