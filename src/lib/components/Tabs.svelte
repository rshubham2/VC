<script lang="ts">
  export let tabs: string[];
  export let activeTab: number = 0;
</script>

<div class="border-b border-gray-200">
  <nav class="-mb-px flex space-x-8" aria-label="Tabs">
    {#each tabs as tab, index}
      <button
        class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
          {index === activeTab
            ? 'border-indigo-500 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
          focus:outline-none transition-colors duration-200"
        on:click={() => (activeTab = index)}
      >
        {tab}
      </button>
    {/each}
  </nav>
</div>
<div class="mt-4">
  <slot></slot>
</div>