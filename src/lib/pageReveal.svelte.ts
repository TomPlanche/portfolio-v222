const createPageReveal = () => {
	const state = $state({ done: false });

	return {
		get done() {
			return state.done;
		},
		complete() {
			state.done = true;
		}
	};
};

export const pageReveal = createPageReveal();
