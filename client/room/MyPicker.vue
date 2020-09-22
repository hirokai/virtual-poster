<template>
  <div class="my-emoji-picker" @blur="onBlur">
    <h2>
      反応を選択 <span class="close-picker" @click="onBlur">&times;</span>
    </h2>
    <div v-for="(emoji, i) in emojis" :key="i" @click="clickEmoji(emoji)">
      {{ emoji.native }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, toRefs } from "vue"

export default defineComponent({
  props: {},
  setup(props, context) {
    const state = reactive({
      emojis: ["👍", "👎", "✋", "🙏", "😄", "😅", "😎", "😱", "😡"].map(c => {
        return { native: c }
      }),
    })
    console.log(state.emojis)
    const clickEmoji = emoji => {
      context.emit("select", emoji)
    }
    const onBlur = () => {
      console.log("onBlur")
      context.emit("close-emoji-picker")
    }
    return { ...toRefs(state), clickEmoji, onBlur }
  },
})
</script>

<style lang="css" scoped>
.my-emoji-picker {
  background: white;
  border: 1px solid black;
  width: 150px;
  height: 120px;
  position: absolute;
  right: 0px;
  margin: 20px 10px auto auto;
  padding: 10px;
  border-radius: 4px;
}

.my-emoji-picker div {
  font-size: 21px;
  float: left;
  margin: 4px 4px;
  cursor: pointer;
}

.my-emoji-picker h2 {
  margin: 0px 0px 10px 0px;
}

.close-picker {
  font-size: 21px;
  float: right;
  cursor: pointer;
}
</style>

},
