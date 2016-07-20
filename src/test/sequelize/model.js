module.exports = {
	schemas : {
		Entity : {
			ID : {
				type : 'STRING',
				allowNull : false,
				primaryKey : true
			},
			type : {
				type : 'STRING'
			}
		},
		Belonging : {
			minorID : {
				type : 'STRING',
				allowNull : false
			},
			majorID : {
				type : 'STRING',
				allowNull : false
			},
			rank : {
				type : 'INTEGER',
				allowNull : false
			}
		},
		Person : {
			ID : {
				type : 'STRING',
				allowNull : false,
				primaryKey : true
			},
			name : {
				type : 'STRING'
			}
		}
	},
	associations : [ {
		minor : [ 'Entity', {
			through : 'Belonging'
		} ],
		major : [ 'Entity', {
			through : 'Belonging'
		} ]
	} ]
};
