<template>
  <div id="app-main" class="mobile" v-cloak>
    <div id="mobile-body">
      <Map
        v-if="!!myself && mobilePane == 'map'"
        :myself="myself"
        :isMobile="true"
        :cellVisibility="cellVisibility"
        :hidden="hidden"
        :people="people"
        :posters="posters"
        :cellSize="48"
        :visualStyle="visualStyle"
        :activePoster="posterLooking ? adjacentPoster : undefined"
        :cells="cellsMag"
        :center="center"
        :mapRadiusX="4"
        :mapRadiusY="7"
        :myChatGroup="myChatGroup"
        :chatGroups="chatGroups"
        :chatGroupOfUser="chatGroupOfUser"
        :selectedPos="selectedPos"
        :selectedUsers="selectedUsers"
        :personInFront="personInFront"
        :objectCellInFront="objectCellInFront.cell"
        :people_typing="people_typing"
        :avatarImages="avatarImages"
        @select="updateSelectedPos"
        @hover="overOnCell"
        @dbl-click="dblClick"
        @upload-poster="uploadPoster"
        @input-arrow-key="inputArrowKey"
      />
      <MiniMap
        v-show="mobilePane == 'minimap'"
        :isMobile="true"
        :room="room"
        :hidden="hidden"
        :cells="hallMap"
        :cellVisibility="cellVisibility"
        :center="center"
        :mapRadiusX="4"
        :mapRadiusY="7"
        :people="people"
        :posters="posters"
        :chatGroups="chatGroups"
        :avatarImages="avatarImages"
        :people_typing="people_typing"
        :selectedPos="selectedPos"
        :visualStyle="visualStyle"
        :mainMapCellSize="mapCellSize"
        :miniMapHighlighted="miniMapHighlighted"
        @select="updateSelectedPos"
        @dbl-click="dblClick"
      />
      <ChatLocal
        ref="chatLocal"
        v-if="mobilePane == 'chat'"
        :locale="locale"
        :axios="axios"
        :isMobile="true"
        :myself="myself"
        :contentHidden="hidden"
        :comments="comments"
        :commentTree="commentTree"
        :events="chat_events"
        :people="people"
        :people_deleted="people_deleted"
        :editingOld="editingOld"
        :chatGroup="myChatGroup ? chatGroups[myChatGroup].users : []"
        :inputFocused="inputFocused"
        :poster="botActive || !posterLooking ? null : adjacentPoster"
        :people_typing="people_typing"
        :enableEncryption="enableEncryption"
        :encryptionPossibleInChat="encryption_possible_in_chat"
        :darkMode="darkMode"
        :mapCellSize="48"
        :highlightUnread="highlightUnread"
        @leave-chat="leaveChat"
        @submit-comment="submitComment"
        @update-comment="sendOrUpdateComment"
        @delete-comment="deleteComment"
        @set-editing-old="setEditingOld"
        @onInputTextChange="onInputTextChange"
        @on-focus-input="onFocusInput"
        @set-encryption="setEncryption"
        @add-emoji-reaction="addEmojiReaction"
        @read-comment="readComment"
      />
      <Poster
        v-show="
          (mobilePane == 'poster' || mobilePane == 'poster_chat') &&
          posterLooking
        "
        ref="posterComponent"
        :axios="axios"
        :locale="locale"
        :isMobile="true"
        :mobilePane="mobilePane"
        :myself="myself"
        :poster="adjacentPoster"
        :uploadProgress="posterUploadProgress"
        :comments="posterComments"
        :commentTree="posterCommentTree"
        :people="people"
        :people_deleted="people_deleted"
        :editingOld="editingOld"
        :posterChatGroup="posterChatGroup"
        :darkMode="darkMode"
        :mapCellSize="48"
        :highlightUnread="highlightUnreadPoster[posterLooking?.id] || {}"
        @submit-poster-comment="submitPosterComment"
        @update-poster-comment="updatePosterComment"
        @delete-comment="deletePosterComment"
        @set-editing-old="setEditingOld"
        @on-focus-input="onFocusInput"
        @upload-poster="uploadPoster"
        @add-emoji-reaction="addEmojiReaction"
        @read-comment="readPosterComment"
        @set-poster="setPoster"
      />
      <div id="tools-on-map" v-if="mobilePane == 'map'">
        <button
          id="enter-poster-on-map"
          class="button is-primary button-top-left"
          @click="$emit('enter-poster')"
          v-if="adjacentPoster && !posterLooking"
        >
          {{ lang("view_poster") }}
        </button>
        <div id="poster-preview" v-if="adjacentPoster && !posterLooking">
          <span style="font-weight: bold"
            >{{ adjacentPoster.poster_number }}:
            {{
              people[adjacentPoster.author]
                ? people[adjacentPoster.author].name
                : ""
            }}</span
          >

          <br />
          {{ adjacentPoster.title }}
          <span
            id="poster-award-nominated"
            v-if="adjacentPoster.metadata?.poster_award_nominated"
          >
            {{ locale == "ja" ? "ポスター賞応募" : "Poster award nominated" }}
          </span>
          <span id="access-log-notice" v-if="adjacentPoster.access_log">
            このポスターを閲覧すると足あとが記録されます
          </span>
        </div>
        <button
          id="start-chat-on-map"
          class="button-top-right"
          @click="startChatInFront"
          v-if="!myChatGroup && personInFront"
        >
          {{ lang("start_chat") }}
        </button>
        <button
          id="view-info-person-on-map"
          @click="viewInfoPersonInFront"
          v-if="!myChatGroup && personInFront"
        >
          {{ lang("profile") }}
        </button>
        <button
          id="view-info-object-on-map"
          class="button is-default button-top-right"
          @click="viewInfoObjectInFront"
          v-if="!ajacentPoster && objectCellInFront"
        >
          {{ lang("view_object") }}
        </button>
        <button id="leave-chat-on-map" @click="leaveChat" v-if="myChatGroup">
          {{ lang("leave_chat") }}
        </button>
      </div>
      <button
        id="leave-poster-on-map"
        class="button is-primary button-top-left"
        @click="leavePoster"
        v-if="posterLooking && (mobilePane == 'poster' || mobilePane == 'map')"
      >
        {{ lang("leave_poster") }}
      </button>
      <div
        id="message"
        :class="{ hide: message.hide }"
        :style="{
          background: message.color,
        }"
      >
        <div id="message-close" @click="hideMessage">&times;</div>
        {{ message.text }}
      </div>
    </div>
    <div id="mobile-menu">
      <div class="mobile-menu-item" @click="moveToPane('minimap')">
        <img src="/img/icon/world.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'minimap'"
        ></div>
      </div>
      <div class="mobile-menu-item" @click="moveToPane('map')">
        <img src="/img/icon/map.png" width="96" alt="" />
        <div class="mobile-menu-item-active" v-if="mobilePane == 'map'">
          &nbsp;
        </div>
      </div>
      <div class="mobile-menu-item" @click="moveToPane('chat')">
        <img src="/img/icon/chat.png" width="96" alt="" />
        <div class="mobile-menu-item-active" v-if="mobilePane == 'chat'"></div>
      </div>
      <div
        class="mobile-menu-item"
        :class="{ disabled: !posterLooking }"
        @click="moveToPane('poster')"
      >
        <img src="/img/icon/new-poster.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'poster'"
        ></div>
      </div>
      <div
        class="mobile-menu-item"
        :class="{ disabled: !posterLooking }"
        @click="moveToPane('poster_chat')"
      >
        <img src="/img/icon/feedback.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'poster_chat'"
        ></div>
      </div>
      <div class="mobile-menu-item" @click="jumpToMyPage">
        <img src="/img/icon/settings.png" width="96" alt="" />
        <div
          class="mobile-menu-item-active"
          v-if="mobilePane == 'mypage'"
        ></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, toRefs, PropType } from "vue"

import {
  RoomAppState,
  PersonInMap,
  Cell,
  Point,
  Poster as PosterTyp,
  CommentEvent,
  Tree,
} from "@/@types/types"

import Map from "./Map.vue"
import MiniMap from "./MiniMap.vue"
import Poster from "./Poster.vue"
import ChatLocal from "./ChatLocal.vue"

import { AxiosInstance } from "axios"

import {
  commentTree as _commentTree,
  DecryptedCommentCommon,
} from "./room_chat_service"

import { playBGM as _playBGM, stopBGM as _stopBGM } from "./room_map_service"

import { ChatGroupId } from "@/api/@types"

export default defineComponent({
  components: {
    Map,
    MiniMap,
    Poster,
    // CellInfo,
    ChatLocal,
    // Notification,
    // MyPage,
  },
  props: {
    axios: {
      type: Function as PropType<AxiosInstance>,
      required: true,
    },
    myself: {
      type: Object as PropType<PersonInMap>,
    },
    locale: {
      type: String as PropType<"ja" | "en">,
      required: true,
    },
    people: {
      type: Object as PropType<{ [index: string]: PersonInMap }>,
      required: true,
    },
    personInFront: {
      type: Object as PropType<PersonInMap>,
    },
    objectCellInFront: {
      type: Object as PropType<Cell>,
    },

    roomAppState: {
      type: Object as PropType<RoomAppState>,
      required: true,
    },
    posterLooking: {
      type: String,
    },
    adjacentPoster: {
      type: Object as PropType<PosterTyp | undefined>,
    },
    commentTree: {
      type: Object as PropType<Tree<DecryptedCommentCommon>>,
      required: true,
    },
    posterCommentTree: {
      type: Object as PropType<Tree<DecryptedCommentCommon>>,
      required: true,
    },
    submitPosterComment: {
      type: Function as PropType<(s: string, e: CommentEvent) => void>,
      required: true,
    },
    updatePosterComment: {
      type: Function as PropType<(s: string, e: CommentEvent) => void>,
      required: true,
    },
    deletePosterComment: {
      type: Function as PropType<(s: string, e: CommentEvent) => void>,
      required: true,
    },
    cellsMag: {
      type: Array as PropType<Cell[][]>,
      required: true,
    },

    uploadPoster: {
      type: Function,
      required: true,
    },
    chatGroupOfUser: {
      type: Object as PropType<{ [userId: string]: ChatGroupId }>,
      required: true,
    },
    myChatGroup: {
      type: String,
    },
  },
  setup(props, context) {
    const state = reactive({
      mobilePane: "map" as string,
    })

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        start_chat: {
          ja: "会話を始める",
          en: "Start chat",
        },
        leave_chat: {
          ja: "会話から離脱",
          en: "Leave chat",
        },
        view_poster: {
          ja: "ポスターを閲覧",
          en: "View poster",
        },

        leave_poster: {
          ja: "ポスターから離脱",
          en: "Leave poster",
        },
        left_chat: {
          ja: "会話から離脱しました。",
          en: "You left the chat.",
        },
        profile: {
          ja: "プロフィール",
          en: "Profile",
        },
        view_object: {
          ja: "調べる",
          en: "Inspect",
        },
        connected: {
          ja: "接続されています",
          en: "Connected",
        },
        disconnected: {
          ja: "接続されていません",
          en: "Disconnected",
        },
        poster_list: {
          ja: "ポスター一覧",
          en: "List of posters",
        },
        mypage: {
          ja: "マイページ",
          en: "Preferences",
        },
        notification: {
          ja: "通知",
          en: "Notification",
        },
        leave_room: {
          ja: "部屋を退出",
          en: "Leave room",
        },
      }
      return message[key][props.locale]
    }

    const moveToPane = (pane: string) => {
      if ((pane == "poster" || pane == "poster_chat") && !props.posterLooking) {
        return
      }
      location.hash = pane
      // state.mobilePane = pane
    }

    if (["", "#"].indexOf(location.hash) != -1) {
      location.hash = "#map"
    } else if (location.hash.indexOf("#mypage") != -1) {
      state.mobilePane = "mypage"
    } else {
      state.mobilePane = location.hash.slice(1)
    }

    window.onhashchange = () => {
      if (["", "#"].indexOf(location.hash) != -1) {
        location.hash = "#map"
      } else if (location.hash.indexOf("#mypage") != -1) {
        state.mobilePane = "mypage"
      } else {
        state.mobilePane = location.hash.slice(1)
      }
    }

    const moveToMypage = (tab: string) => {
      location.hash = "#mypage/" + tab
    }

    const leavePoster = () => {
      context.emit("leave-poster")
      location.hash = "#map"
    }

    const startChatInFront = () => {
      context.emit("start-chat-in-front")
      location.hash = "#chat"
    }

    const leaveChat = () => {
      context.emit("leave-chat")
      location.hash = "#map"
    }

    const dblClick = (p: Point) => {
      console.log("dblClick!", p)
      context.emit("dbl-click", p)
    }

    const jumpToMyPage = () => {
      location.href = "/mypage"
    }

    return {
      ...toRefs(state),
      ...toRefs(props.roomAppState),
      moveToPane,
      moveToMypage,
      lang,
      leavePoster,
      startChatInFront,
      leaveChat,
      dblClick,
      jumpToMyPage,
      readPosterComment: () => {
        //
      },
    }
  },
})
</script>

<style lang="css" scoped>
#app-main.mobile {
  height: 100%;
  width: 100%;
  /* margin: 0px 0px calc(100vw / 6) 0px; */
  /* display: flex; */
  align-items: flex-end;
}

#mobile-body {
  position: relative;
  /* flex: 1 1 0%; */
  contain: size layout style;
  width: 100%;
  height: calc(100vh - 100vw / 6 - 5px);
}

.mobile button.button-top-left {
  position: absolute;
  font-size: 20px;
  left: 0vw;
  top: 0px;
  width: 50vw !important;
  height: 40px;
  z-index: 1000;
}

.mobile button.button-top-right {
  position: absolute;
  font-size: 20px;
  left: 50vw;
  top: 0px;
  width: 50vw !important;
  height: 40px;
  z-index: 1000;
}

.mobile div#poster-preview {
  left: 5vw;
  top: 50px;
  width: 90vw;
  min-height: 10vh;
}

#mobile-menu {
  display: flex;
  position: fixed;
  bottom: 0px;
  right: 0px;
  height: calc(100vw / 6 * 0.7 + 5px);
  width: 100%;
  bottom: 0px;
  /* top: calc(100vh - 100vw / 6); */
  z-index: 100;
}

.mobile-menu-item {
  flex-grow: 1;
  background: #bbb;
  /* width: calc(100vw / 6); */
  height: 105%;
  margin: 0px;
  margin-bottom: 30px;
  float: left;
  padding-top: 10px;
}

.mobile-menu-item img {
  height: calc(100vw / 6 * 0.5);
  width: calc(100vw / 6 * 0.5);
  /* margin: calc((100vw / 6) / 2); */
  margin-top: 10px;
  margin: auto;
  display: block;
  text-align: center;
}

.mobile-menu-item.disabled img {
  opacity: 0.3;
}

.mobile-menu-item-active {
  position: absolute;
  background: #33f;
  width: calc(100vw / 6);
  height: calc(100vw / 6 / 10);
  bottom: 0px;
}

#tools-on-map {
  z-index: 10;
}
</style>
