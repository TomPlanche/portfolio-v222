<script lang="ts">
	import '$lib/styles/main.scss';

	import favicon from '/static/zoizo.png';
	import PixelReveal from '$lib/components/PixelReveal.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />

	<meta content="Tom Planche's website" property="og:title">
	<meta content={favicon} property="og:image">
	<meta content="image/png" property="og:image:type">
	<meta content="424" property="og:image:width">
	<meta content="440" property="og:image:height">
	<meta content="Nora's drawing of us as birds in a heart shape" property="og:image:alt">
</svelte:head>

<PixelReveal />
<div id="noise"></div>

<main>
	{@render children()}
</main>

<Footer lastCommit={data.lastCommit} />

<style>
    main {
        padding: 2rem 4vmin;
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