<script lang="ts">
	import '$lib/styles/main.scss';

	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div id="noise"></div>

<main>
	{@render children()}
</main>


<style>
    main {
        padding: 2rem 10vmin;
    }

    #noise {
        pointer-events: none;
        z-index: 99999;
        opacity: 0.06;
        background-image: url(/noise.gif);
        background-position: 0 0;
        background-size: 250px;
        background-attachment: fixed;
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
    }
</style>