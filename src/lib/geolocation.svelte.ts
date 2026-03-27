type GeolocationState = {
	coords: GeolocationCoordinates | null;
	error: GeolocationPositionError | null;
	loading: boolean;
};

const createGeolocation = () => {
	const state = $state<GeolocationState>({
		coords: null,
		error: null,
		loading: false
	});

	const request = () => {
		if (!navigator.geolocation) {
			return;
		}

		state.loading = true;
		state.error = null;

		navigator.geolocation.getCurrentPosition(
			(position) => {
				state.coords = position.coords;
				state.loading = false;
			},
			(error) => {
				state.error = error;
				state.loading = false;
			}
		);
	};

	return {
		get coords() {
			return state.coords;
		},
		get error() {
			return state.error;
		},
		get loading() {
			return state.loading;
		},
		request
	};
};

export const geolocation = createGeolocation();
