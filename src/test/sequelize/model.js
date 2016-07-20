require('cpx-etl').register(function() {
	return {
		schemas : {
			Entity : {
				ID : {
					type : DataTypes.STRING,
					allowNull : false,
					primaryKey : true
				},
				type : 'STRING'
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
					type : DataTypes.STRING,
					allowNull : false,
					primaryKey : true					
				},
				name : 'STRING'
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
});
