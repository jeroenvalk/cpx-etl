module.exports = function(cpx, _, Q) {
	return function($) {
		return {
			Person : {
				_ : {
					where : {
						unique: true,
						required: false,
						name : $.name
					}
				},
				Entity : {
					_ : {
						unique: true,
						required: true,
						where : {
							type: 'person'
						}
					}
				}
			}
		};
	};
};
