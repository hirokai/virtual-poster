<template>
  <div class="tab-content">
    <nav class="breadcrumb" aria-label="breadcrumbs">
      <ul>
        <li :class="{ 'is-active': !room && !new_room }">
          <a href="#rooms" @click="changeRoom(null)">{{lang("venue")}}</a>
        </li>
        <li v-if="room" :class="{ 'is-active': !room_subpage }">
          <a :href="'#rooms/' + room.id">{{ room.name }}</a>
        </li>
        <li v-if="room_subpage == 'chat'" :class="{ 'is-active': true }">
          <a>{{lang('chat')}}</a>
        </li>
        <li v-if="room_subpage == 'posters'" :class="{ 'is-active': true }">
          <a>{{lang('posters')}}</a>
        </li>
        <li v-if="room_subpage == 'users'" :class="{ 'is-active': true }">
          <a>{{lang('users')}}</a>
        </li>
        <li v-if="new_room" :class="{ 'is-active': true }">
          <a>{{lang('create')}}</a>
        </li>
      </ul>
    </nav>
    <table v-if="new_room">
      <tr>
        <td>マップ</td>

        <td>二次元のキャラクタ表記を含むYAML形式</td>
        <td>
          <form class="file_upload">
            <input
              accept="application/yaml"
              type="file"
              id="file"
              v-on:change="onFileChange('map.yaml', $event)"
            />
            <input
              type="submit"
              value="アップロード"
              :disabled="!files['map.yaml']"
              @click="submitClick('map.yaml')"
            />
          </form>
        </td>
      </tr>
    </table>

    <section id="room-list" v-if="!room && !new_room">
            <h5 class="title is-5">{{locale == 'ja' ? `${(admin_page ? '' : 'アクセス可能な')}会場の一覧` : `List of ${admin_page ? '' : 'available '}rooms`}}</h5>
      <div>
        <!-- <button class="button is-primary" @click="newRoom">新規作成</button> -->
              <a href="/create_room" class="button is-primary">{{lang('create')}}</a>

      </div>
      <table class='table'>
        <thead>
          <tr>
            <th>ID</th>
            <th class="r1"></th>
            <th>{{lang('name')}}</th>
            <th></th>
            <th>{{lang('map')}}</th>
            <th>{{admin_page ?  lang('num_people_admin'): lang('num_people')}}</th>
            <th>{{lang('posters')}}</th>
            <th>{{lang('owner')}}</th>
          </tr>
        </thead>
        <tr v-for="room in rooms" :key="room.id">
          <td class='room-id'>{{ room.id }}</td>
          <td class="r1"></td>
          <td>
            <a :href="'/room?room_id=' + room.id">{{
              room.name
            }}</a>
          </td>
          <td v-if="room.owner == myUserId || room.admins?.indexOf(myUserId) >= 0 || admin_page" >  
            <button class='button is-small' :href="'#rooms/' + room.id" @click="changeRoom(room.id)">設定</button>
            <button class='button is-small' v-if="room.owner == myUserId || admin_page" @click="deleteRoom(room.id)">削除</button>
          </td>
          <td v-else></td>
          <td>
            {{ room.numCols * room.numRows }} マス（縦 {{ room.numCols }} x 横
            {{ room.numRows }}）
          </td>
          <td>
            <span v-if='admin_page'>
            {{ room.num_people_joined }} 人入場 /
            {{ room.num_people_with_access }} 人の参加資格者

            </span>
            <span v-else>{{ room.num_people_joined }}</span>
          </td>
          <td>
            {{ room.poster_count }} 枚 / {{ room.poster_location_count }} 枠
          </td>
          <td>{{ people[room.owner]?.name }}({{ room.owner }})</td>
        </tr>
      </table>
    </section>

    <div v-if="room" id="room-nav">
      <a :href="'#rooms/' + room.id" :class="{ active: !room_subpage }">{{lang('general')}}</a>
      <a
        :href="'#rooms/' + room.id + '/map'"
        :class="{ active: room_subpage == 'map' }"
        >{{lang('map')}}</a
      >
      <a
        :href="'#rooms/' + room.id + '/users'"
        :class="{ active: room_subpage == 'users' }"
        >{{lang('users')}}</a
      >
      <a
        :href="'#rooms/' + room.id + '/posters'"
        :class="{ active: room_subpage == 'posters' }"
        >{{lang('posters')}}</a
      >
      <a
        :href="'#rooms/' + room.id + '/chat'"
        :class="{ active: room_subpage == 'chat' }"
        >{{lang('chat')}}</a
      >
    </div>

    <div v-if="room && !room_subpage">
      <div>
        <section>
           <h5 class='title is-5'>会場の概要</h5>
          <h3>{{lang('owner')}}: {{people[room.owner].name}}（{{room.owner}}）</h3>
          <h3>
            マップ：{{ room.numCols * room.numRows }}（縦{{ room.numCols }} x
            横{{ room.numRows }}）
          </h3>
          <h3>
            <a :href="'#rooms/' + room.id + '/users'">参加者</a>：
            {{ room.num_people_joined }} 人入場 /
            {{ room.num_people_with_access }} 人の参加資格者
          </h3>
          <h3>
            <a :href="'#rooms/' + room.id + '/posters'">ポスター</a>：
            {{ room.poster_count }}枚掲示/ {{ room.poster_location_count }}枠
          </h3>
          <h3>
            <a :href="'#rooms/' + room.id + '/chat'">チャット</a>：
            {{ Object.values(chatGroups).length }} グループ
          </h3>
        </section>
      </div>
      <div>
        <section>
           <h5 class='title is-5'>設定</h5>
          <div>
            <input
            type="checkbox"
            name=""
            id="room-config-allow-self-assign-poster"
            v-model="roomConfig.allowPosterAssignment"
          />
          <label for="room-config-allow-self-assign-poster"
            >ユーザーによるポスター板の確保・解放およびタイトルの編集を許可する</label
          ><br />
          <input
            type="checkbox"
            name=""
            id="room-config-hide-unvisited"
            v-model="roomConfig.hideUnvisited"
          />
                    <label for="room-config-hide-unvisited"
            >マップの未探索の部分を隠す</label
          ><br />
          </div>

          <div>
            <h2 class='is-5'>アクセスコード</h2>
             <button
              class="button is-primary is-small"
              @click="createAccessCode(room.id)"
              style="margin-right: 5px;"
            >
              {{ lang('create_code') }}
            </button>
            <div class='access-code-entry' v-for="access_code in room.access_codes" :key="access_code.code">
            <span class="access-code">{{
              access_code.code || "(なし)"
            }}</span>
            <input
              type="checkbox"
              name=""
              v-model="accessCodeActive[access_code.code]"
              @change="onChangeCodeActive(access_code.code,$event)"
            />
            <label :for="'access-code-active-' + access_code.code">有効</label>
           
            <button
              class="button is-danger is-small"
              @click="deleteAccessCode(room.id, access_code.code)"
            >
              削除
            </button>
            <div>URL: <input class='access-code-url' type="text" readonly :value="accessCodeUrl(access_code.code) || '（なし）'"></div>
            <div>付与するアクセス： <input v-if='editingCodeAccess == access_code.code' class='access-code-url' type="text" placeholder='ユーザーグループID，ユーザーグループ名などを;;で区切って入力' ref='inputCodeAccess'>
            <span v-else>
              <span class='code-right-entry' v-for='r in access_code.access_granted' :key='r' :class="{valid: !!peopleGroups[r]?.name}">{{peopleGroups[r]?.name || r}}</span>
            </span>
            <span v-if='editingCodeAccess == access_code.code'>
            <button class="button is-default is-small"  @click='finishEditingCodeRights'>{{  '完了' }}</button>  
            <button class="button is-default is-small"  @click='editingCodeAccess = undefined'>{{  'キャンセル' }}</button>  

            </span>
            <button class="button is-default is-small" v-else @click='startEditingCodeRights(access_code)'>{{  '編集' }}</button>  
            </div>

            </div>
          </div>
          
        </section>
      </div>
    </div>

    <section v-if="room && !room_subpage">
           <h5 class='title is-5'>アナウンス</h5>
      <div>
        <small>※HTMLも送信可能（危険なリンクなどを送らないように注意）</small>
      </div>
      <textarea cols="60" rows="2" id="announce-input" ref="announceText" />
      <button @click="submitAnnouncement">
        送信
      </button>
      <div>
        <label for="marquee">文字を流す</label>
        <input type="checkbox" id="marquee" v-model="announceMarquee" /><br />
        <label for="marquee-period" :disabled="!announceMarquee"
          >周期 [秒]</label
        >
        <input
          type="number"
          max="60"
          min="3"
          id="marquee-period"
          :disabled="!announceMarquee"
          v-model="announceMarqueePeriod"
        />
      </div>
      <div>
        <button @click="askReload(false)">
          会場の参加者にリロードを依頼
        </button>
      </div>
      <div>
        <button @click="askReload(true)">
          会場の参加者を強制的にリロード
        </button>
      </div>
    </section>
    <ManageRoomPosters
      v-if="room && room_subpage == 'posters'"
      :myUserId="myUserId"
      :room="room"
      :peopleInRoom="peopleInRoom"
      :peopleHavingAccess="peopleHavingAccess"
      :posters="postersInRoom"
      :poster_cells="poster_cells"
    />
    <section v-if="room && room_subpage == 'map'">
           <h5 class='title is-5'>マップ</h5>
      <div>
        {{ room.numCols * room.numRows }} マス（縦{{ room.numCols }} x 横{{
          room.numRows
        }}）
      </div>
      <div>
        <div >
        <div class="buttons has-addons" style='float: left;'>
                <span style="margin-right: 10px; vertical-align: 20px">{{
                  lang("preview_size")
                }}</span>
                <button
                  class="button"
                  :class="{ 'is-primary': mapCellSize == 48 }"
                  @click="mapCellSize= 48"
                >
                  {{ lang("large") }}
                </button>
                <button
                  class="button"
                  :class="{ 'is-primary': mapCellSize == 32 }"
                  @click="mapCellSize= 24"
                >
                  {{ lang("medium") }}
                </button>
                <button
                  class="button"
                  :class="{ 'is-primary': mapCellSize == 16 }"
                  @click="mapCellSize= 8"
                >
                  {{ lang("small") }}
                </button>
              </div>
        <div>
                  <button class="button is-primary" @click="clearMapCache" style='float: left;'>キャッシュをクリア</button>
                  <div style='clear:both;'></div>
                  </div>

          <div class='columns mx-0'>
            <div class="column is-two-thirds">
          <span>マップ修正</span><br>
          <textarea name="" id="input-patch" placeholder="JSON形式で入力" ref='mapPatchJsonTextArea' @input="onInputPatch"></textarea><br>


            </div>
            <div class="column is-one-third">
<div id="drop-replace-map"
        :class="{dragover: dragoverMapReplace}"
                      @dragover.prevent
              @drop.prevent="onDropReplaceMap"
              @dragover="dragoverMapReplace = true"
              @dragleave="dragoverMapReplace = false"

>マップの差し替え</div>
            </div>

          </div>
          <div class="columns mx-0">
            <div class="column is-full">
              <input type="text" placeholder='メッセージ' ref="inputMapChangeMessage" id='input-mapchange-message'>
              <button class='button is-primary' @click='submitMapCellPatch' :disabled="!verifyInputPatch(inputPatchText)&& !replaceMapData">送信</button>
            </div>
          </div>
        </div>
        
        </div> 
        <div>
          <svg :width="mapCellSize * ((mapCells && mapCells[0]) ? mapCells[0].length : 0)" :height="mapCellSize * (mapCells ? mapCells.length : 0)">
            <g v-for='(row,yi) in mapCells' :key="yi" :transform="'translate(0 '+(yi*mapCellSize)+')'">
    
    <MapCell
        v-for="(cell, xi) in row"
        :cell="cell"
        :myself="people[myUserId]"
        :people="people"
        :key="'' + xi + '.' + yi"
        :selected="
          !!selectedMapPos && cell.x == selectedMapPos.x && cell.y == selectedMapPos.y
        "
        :left="(cell.x) * mapCellSize"
        :top="0"
        :cellSize="mapCellSize"
        :visualStyle="'default'"
        @select="selectMapCell"
        @hover-cell="hoverCell"
      />
     
                  </g>
          </svg>
        </div>
    </section>
    <section v-if="room && room_subpage == 'chat'">
                 <h5 class='title is-5'>チャットグループ一覧</h5>
      <div v-if="chatGroupsSorted.length == 0">
        チャットなし
      </div>
      <div v-else>
        <table>
          <thead>
            <th>ID</th>
            <th>色</th>
            <th>参加者</th>
          </thead>
          <tbody>
            <tr id='chat-groups' v-for="g in chatGroupsSorted" :key="g.id"  >
              <td>{{ g.id }}</td>
              <td :style="{color: g.color}">{{ g.color }}</td>
              <td><span class='chat-user' v-for='u in g.users' :key="u">{{people[u].name}}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section v-if="room && room_subpage == 'users'">
      <div>
              <h5 class='title is-5'>{{lang('user_groups')}}</h5>
              <table class="table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        name=""
                        id=""
                        @change="checkAllPeopleGroups"
                        ref="checkboxAllPeopleGroups"
                      />
                    </th>
                    <th>ID</th>
                    <th>名前</th>
                    <th>人数</th>
                    <th>説明</th>
                  </tr>
                </thead>
                <tbody v-if='!room.people_groups || room.people_groups.length == 0'>
                  <tr>
                    <td>（グループなし）</td>
                  </tr>
                </tbody>
                                <tbody v-else>
                  <tr v-for='g in room.people_groups' :key='g.id'>
                    <td>
                      <input
                        type="checkbox"
                        name=""
                        :id="'check-group-'+g.id"
                        :checked="selectedPeopleGroup[g.id] == true"
                        @change="checkPeopleGroup(g.id, $event)"
                      />
                    </td>
                    <td><label :for="'check-group-'+g.id">{{g.id}}</label></td>
                    <td>{{g.name}}</td>
                    <td></td>
                    <td>{{g.description}}</td>
                  </tr>
                </tbody>
              </table>

      </div>
      <h5 class='title is-5'>{{lang('user_list')}}</h5>
      <div id="user-list-tools">
        <div style='margin: 0px 0px 10px 0px'>
        <button class="button is-primary is-small" @click='startAssignUserBatchDialog'>一括で追加</button>
        <button class="button is-primary is-small" @click='startAssignUserDialog'>追加</button>
        </div>
        <input
          type="text"
          id="search-user"
          @input="inputSearchUser"
          @compositionstart="searchUserTextComposition = true"
          @compositionend="searchUserTextComposition = false"
          @keydown.enter="inputSearchUser"
        />
        <span>{{ countSelected }}人を選択中</span>
        <button class="button is-danger is-small" @click="removeUser" :disabled="countSelected == 0">
          削除
        </button>
        <button class="button is-primary is-small" @click="assignRole('admin')" :disabled="countSelected == 0 || allAdmins">
          管理者にする
        </button>
        <button class="button is-primary is-small" @click="assignRole('user')" :disabled="countSelected == 0 || allNonAdmins">
          通常ユーザーにする
        </button>
         <button class="button is-primary is-small" @click="assignPeopleGroups" :disabled="countSelected == 0 || countSelectedGroups == 0">
          グループを割り当て
        </button>
         <button class="button is-primary is-small" @click="unassignPeopleGroups" :disabled="countSelected == 0 || countSelectedGroups == 0">
          グループから外す
        </button>
      </div>
      <div v-if="peopleHavingAccess.length == 0">
        参加資格者なし
      </div>
      <div v-else>
        <table id='user-table' class='table'>
          <thead>
            <th>
              <input
                type="checkbox"
                name=""
                id=""
                @change="checkAllWithAccess"
                ref="checkboxAllPeopleHavingAccess"
              />
            </th>
            <th>Email</th>
            <th>ID</th>
            <th>{{lang('name')}}</th>
            <th>{{lang('coord')}}</th>
            <th></th>
            <th>{{lang('user_groups')}}</th>
          </thead>
          <tbody>
            <tr v-for="p in peopleHavingAccessFiltered" :key="p.id" :class="{bold: p.in_room?.role == 'owner' || p.in_room?.role == 'admin'}">
              <td>
                <input
                  type="checkbox"
                  name=""
                  :id="'check-'+p.email"
                  :checked="selectedHavingAccess[p.email] == true"
                  @change="checkPersonWithAccess(p.email, $event)"
                />
              </td>
              <td><label :for="'check-'+p.email">{{ p.email }}</label></td>
              <td :colspan="p.registered ? 1 : 2">{{ p.registered?.id || '（未入場または未登録）' }}</td>
              <td v-if="p.registered">{{ p.registered?.name }}</td>
              <td v-if="p.in_room">({{ p.in_room.x }}, {{p.in_room.y}})</td>
              <td v-else>（未入場）</td>
              <td v-if='p.in_room?.role == "owner"'>{{lang('owner')}}</td>
              <td v-else-if='p.in_room?.role == "admin"'>{{lang('admin')}}</td>
              <td v-else></td>
              <td v-if='p.people_groups.length > 0'>
                <span v-for="gid in p.people_groups" :key="gid" class='code-right-entry'>{{peopleGroups[gid]?.name}}</span>
              </td>
              <td v-else>グループなし</td>
            </tr>
          </tbody>
        </table>
      </div>
       <div
      id="assign-user-dialog"
      class="modal"
      :class="{ 'is-active': assignUserDialog }"
       @keydown.esc="cancelAssignUserDialog"
    >
      <div
        class="modal-background"
        @click="assignUserDialog = false"
      ></div>
      <div class="modal-content">
        <h1>ユーザーの追加</h1>
        <div style="margin: 10px; line-height: 1.5em; vertical-align: top;">
          <label for="assign-user-email">Email</label>
          <input
            type="text"
            name=""
            id="assign-user-email"
            ref="assignUserEmail"
          /><br />
        </div>
        <div style="margin: 10px">
          <button
            class="button is-primary"
            @click="assignUser"
          >
            OK
          </button>
          <button class="button is-default" @click="cancelAssignUserDialog">
            キャンセル
          </button>
        </div>
      </div>
      <button
        class="modal-close is-large"
        aria-label="close"
        @click="assignUserDialog = false"
      ></button>
    </div>
      <div
      id="assign-user-batch-dialog"
      class="modal"
      :class="{ 'is-active': assignUserBatchDialog }"
      @keydown.esc="cancelAssignUserBatchDialog"
    >
      <div
        class="modal-background"
        @click="assignUserBatchDialog = false"
      ></div>
      <div class="modal-content">
        <h1>ユーザーの一括追加</h1>
        <div style="margin: 10px; line-height: 1.5em; vertical-align: top;">
          <p>
            CSVファイルを選択してください。
            <ul>
              <li>1行目は見出し行として無視されます。</li>
              <li>2行目以降，各行が1人のユーザーに対応します。</li>
              <li>Emailを1行ずつ入力してください。</li>
            </ul>
            
          </p>
          <input
            type="file"
            name=""
            id=""
            ref="assignUserFile"
            @change="onUserBatchFileChanged"
            accept="text/csv"
          />
        </div>
        <div id='user-assign-preview'>
          <table>
            <thead>
              <tr>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry,i) in userAssignment" :key="i" :class="{'is-invalid': !entry.valid}">
                <td>{{entry.email}}</td> 
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin: 10px">
          <button class="button is-primary" @click="assignUserBatch">
            送信
          </button>
          <button
            class="button is-default"
            @click="cancelAssignUserBatchDialog"
          >
            キャンセル
          </button>
        </div>
      </div>
      <button
        class="modal-close is-large"
        aria-label="close"
        @click="assignUserBatchDialog = false"
      ></button>
    </div>
    </section>
  </div>
</template>

<script lang="ts">
import * as Papa from "papaparse"
import {
  RoomId,
  Room,
  Poster,
  PosterId,
  ChatGroup,
  PersonWithEmailRooms,
  AccessRule,
  PersonWithMapAccess,
  PersonUpdate,
  MapUpdateEntry,
  UserGroupId,
} from "@/@types/types"
import axiosDefault from "axios"
import { AxiosStatic } from "axios"
import { decodeMoved, flatten, keyBy, keyByFunc, sortBy } from "@/common/util"
const API_ROOT = "/api"
const axios = axiosDefault.create({ baseURL: API_ROOT })
import axiosClient from "@aspida/axios"
import api from "@/api/$api"
import {
  defineComponent,
  reactive,
  onMounted,
  toRefs,
  PropType,
  computed,
  watch,
  ref,
  nextTick,
} from "vue"
import { Cell, ChatGroupId, PersonInMap } from "@/api/@types"
import ManageRoomPosters from "./ManageRoomPosters.vue"
import MapCell from "../room/MapCell.vue"
import { verifyMapUpdateEntries } from "@/common/maps"

export default defineComponent({
  components: {
    ManageRoomPosters,
    MapCell,
  },
  props: {
    locale: {
      type: String,
      enum: ["ja", "en"],
      required: true,
    },
    admin_page: {
      type: Boolean,
    },
    myUserId: {
      type: String,
      required: true,
    },
    axios: {
      type: Function as PropType<AxiosStatic>,
      required: true,
    },
    socket: {
      type: Object as PropType<SocketIOClient.Socket>,
    },
    rooms: {
      type: Object as PropType<{ [room_id: string]: Room }>,
      required: true,
    },
    room: {
      type: Object as PropType<Room>,
    },
    room_subpage: {
      type: String,
    },
    new_room: {
      type: Boolean,
      required: true,
    },
    people: {
      type: Object as PropType<{ [user_id: string]: PersonWithEmailRooms }>,
      required: true,
    },
  },
  emits: [
    "reload-rooms",
    "delete-room",
    "change-room",
    "make-announcement",
    "ask-reload",
    "create-access-code",
    "renew-access-code",
    "delete-access-code",
    "reload-room-metadata",
  ],
  setup(props, context) {
    const client = api(axiosClient(axios))
    const state = reactive({
      peopleInRoom: {} as { [user_id: string]: PersonInMap },
      peopleHavingAccess: [] as PersonWithMapAccess[],
      API_ROOT,
      postersInRoom: {} as { [poster_id: string]: Poster },
      files: {} as { [index: string]: File },
      file_urls: {} as { [poster_id: string]: string },
      dragover: {} as { [poster_id: string]: boolean },
      chatGroups: {} as { [group_id: string]: ChatGroup },
      announceMarquee: false,
      announceMarqueePeriod: 20,
      roomConfig: {
        allowPosterAssignment: props.room?.allow_poster_assignment,
        hideUnvisited: props.room
          ? props.room.minimap_visibility == "all_only_visited"
          : undefined,
      },
      peopleWithAccessAllChecked: false as boolean | undefined,
      selectedHavingAccess: {} as { [email: string]: boolean },
      peopleGroupAllChecked: false as boolean | undefined,
      selectedPeopleGroup: {} as { [people_group_id: string]: boolean },
      searchUserText: null as string | null,
      searchUserTextComposition: false,
      poster_cells: [] as Cell[],
      accessCodeActive: {} as { [code: string]: boolean },
      assignUserDialog: false,
      assignUserBatchDialog: false,
      userAssignment: [] as {
        valid: boolean
        email: string
        groups: string[]
      }[],
      mapCells: undefined as Cell[][] | undefined,
      mapCellSize: 8,
      selectedMapPos: undefined as { x: number; y: number } | undefined,
      dragoverMapReplace: false,
      replaceMapData: "",
      inputPatchText: "",
      editingCodeAccess: undefined as string | undefined,
    })

    const lang = (key: string): string => {
      const message: {
        [key in string]: { [key in "ja" | "en"]: string }
      } = {
        create: {
          ja: "新規作成",
          en: "Create a new room",
        },

        name: {
          ja: "名前",
          en: "Name",
        },
        map: {
          ja: "マップ",
          en: "Map",
        },
        chat: {
          ja: "チャット",
          en: "Chat",
        },
        users: {
          ja: "ユーザー",
          en: "People",
        },
        user_groups: {
          ja: "ユーザーグループ",
          en: "Groups",
        },
        user_list: {
          ja: "ユーザー一覧",
          en: "List of people",
        },
        posters: {
          ja: "ポスター",
          en: "Posters",
        },
        owner: {
          ja: "オーナー",
          en: "Owner",
        },
        admin: {
          ja: "管理者",
          en: "Admin",
        },
        num_people_admin: {
          ja: "参加者数（入場／参加資格者）",
          en: "Participants (joined / accesible)",
        },
        num_people: {
          ja: "入場者数",
          en: "Joined people",
        },
        venue: {
          ja: "会場",
          en: "Rooms",
        },
        general: {
          ja: "概要",
          en: "General",
        },
        create_code: {
          ja: "作成",
          en: "Create",
        },
        coord: {
          ja: "座標",
          en: "Coordinate",
        },
        size: {
          ja: "サイズ",
          en: "Size",
        },
        preview_size: {
          ja: "プレビューサイズ",
          en: "Preview size",
        },
        large: {
          ja: "大",
          en: "Large",
        },
        medium: {
          ja: "中",
          en: "Medium",
        },
        small: {
          ja: "小",
          en: "Small",
        },
      }
      return message[key][props.locale]
    }

    const chatGroupsSorted = computed(() => {
      return sortBy(Object.values(state.chatGroups), g => g.timestamp)
    })

    const loadMapCells = async (room_id: RoomId) => {
      const cells = (await client.maps._roomId(room_id).cells.$get()).cells
      state.mapCells = cells
    }

    const loadPeopleInMap = async () => {
      const room_id = props.room?.id
      if (!room_id) {
        console.warn("Room ID empty")
        return
      }
      state.peopleInRoom = keyBy(
        await client.maps
          ._roomId(room_id)
          .people.$get({ query: { email: true, groups: true } }),
        "id"
      )
    }

    watch(
      () => state.peopleInRoom,
      async () => {
        const room_id = props.room?.id
        if (!room_id) {
          return
        }
        const peopleByEmail = keyByFunc(
          Object.values(props.people),
          p => p.email
        )
        const peopleInRoomByEmail = keyByFunc(
          Object.values(state.peopleInRoom),
          p => p.email || "NA"
        )
        const allowed_emails = (
          await client.maps._roomId(room_id).people_allowed.$get()
        ).people

        state.peopleHavingAccess = sortBy(allowed_emails, p => {
          const pr = peopleInRoomByEmail[p.email]
          return (
            "" +
            (pr?.role == "owner" ? 0 : pr?.role == "admin" ? 1 : pr ? 2 : 3) +
            ":" +
            p.email
          )
        }).map(p => {
          const p3 = peopleInRoomByEmail[p.email]
          const p1 = peopleByEmail[p.email] || props.people[p3?.id]
          const p2: PersonInMap | undefined = peopleInRoomByEmail[p.email]
          if (p1) {
            return {
              email: p.email,
              people_groups: p.groups || [],
              registered: {
                id: p1.id,
                avatar: p1.avatar!,
                connected: p1.connected!,
                public_key: p1.public_key,
                last_updated: p1.last_updated,
                name: p1.name,
              },
              in_room: p2
                ? {
                    x: p2.x,
                    y: p2.y,
                    direction: p2.direction,
                    moving: p2.moving,
                    stats: p2.stats,
                    poster_vieweing: p2.poster_viewing,
                    role: p2.role,
                  }
                : undefined,
            }
          } else {
            return { email: p.email, people_groups: p.groups || [] }
          }
        })
        console.log(state.peopleHavingAccess)
      },
      { deep: true }
    )

    const loadChatGroups = async () => {
      const room_id = props.room?.id
      if (room_id) {
        const groups = await client.maps._roomId(room_id).chat_groups.$get()
        state.chatGroups = keyBy(groups, "id")
      } else {
        state.chatGroups = {}
      }
    }

    watch(
      () => props.socket,
      () => {
        if (props.socket) {
          props.socket.on("Group", (g: ChatGroup) => {
            state.chatGroups[g.id] = g
          })
          props.socket.on("GroupRemove", (gid: ChatGroupId) => {
            delete state.chatGroups[gid]
          })

          props.socket.on("PersonUpdate", (ds: PersonUpdate[]) => {
            for (const d of ds) {
              const p: PersonInMap = state.peopleInRoom[d.id]
              if (!p) {
                console.warn("User not found (probably new user)")
                continue
              }
              const person: PersonInMap = {
                id: d.id,
                room: p.room,
                x: d.x || p.x,
                y: d.y || p.y,
                direction: d.direction || p.direction,
                moving: d.moving || p.moving,
                name: d.name || p.name,
                last_updated: d.last_updated,
                stats: d.stats || p.stats,
                email: p.email,
                role: d.role || p.role,
              }
              state.peopleInRoom[d.id] = person
            }
          })

          props.socket.on("Moved", data => {
            const ss = data.split(";")
            for (const s of ss) {
              const pos = decodeMoved(s)
              console.log(pos)
              if (pos?.room && pos.room == props.room?.id) {
                state.peopleInRoom[pos.user].x = pos.x
                state.peopleInRoom[pos.user].y = pos.y
                state.peopleInRoom[pos.user].direction = pos.direction
              }
            }
          })
        }
      }
    )
    const loadPosterLocations = async (room_id: RoomId) => {
      const r = await client.maps._roomId(room_id).cells.$get()
      state.poster_cells = flatten(r.cells).filter(
        c => c.poster_number != undefined
      )
      state.postersInRoom = keyBy(
        await client.maps._roomId(room_id).posters.$get(),
        "id"
      )
      for (const p of Object.values(state.postersInRoom)) {
        if (p.file_url == "not_disclosed") {
          p.file_url =
            (await client.posters._posterId(p.id).file_url.$get()).url ||
            p.file_url
        }
        // if (p.file_url) {
        //   p.file_url += "?timestamp=" + p.last_updated  //CloudFront gives error
        // }
      }
    }

    const loadRoom = async (room: Room) => {
      if (room) {
        for (const code of room.access_codes || []) {
          console.log({ code })
          state.accessCodeActive[code.code] = code.active
        }
        state.roomConfig.allowPosterAssignment = room.allow_poster_assignment
        state.roomConfig.hideUnvisited =
          room.minimap_visibility == "all_only_visited"

        await loadChatGroups()
        await loadPeopleInMap()
        await loadPosterLocations(room.id)
        await loadMapCells(room.id)
      } else {
        console.error("Room ID empty")
      }
    }

    onMounted(async () => {
      const room_id = props.room?.id
      if (room_id) {
        await loadRoom(props.rooms[room_id])
      }
    })

    const onFileChange = (name: string, e) => {
      //Vue.set
      state.files[name] = (e.target.files || e.dataTransfer.files)[0]
    }
    const submitClick = async (name: string) => {
      console.log("submitClick", state.files[name])
      try {
        const formData = new FormData()
        formData.append("file", state.files[name])
        const config = {
          headers: {
            "content-type": "multipart/form-data",
          },
        }
        const res = await props.axios.post(
          "/admin/import/" + name,
          formData,
          config
        )
        console.log(res.data)
        if (!res.data.ok) {
          alert("エラー。" + (res.data.error || ""))
        } else {
          try {
            context.emit("reload-rooms")
            alert("登録完了")
          } catch (err) {
            console.log(err)
          }
        }
        return true
      } catch (error) {
        alert("ファイルの送信に失敗しました")
        return true
      }
    }

    const downloadFile = (filename: string, text: string): void => {
      const element = document.createElement("a")
      element.setAttribute(
        "href",
        "data:text/csv;charset=utf-8," + encodeURIComponent(text)
      )
      element.setAttribute("download", filename)

      element.style.display = "none"
      document.body.appendChild(element)

      element.click()

      document.body.removeChild(element)
    }

    const downloadUrl = async (url: string, filename: string) => {
      const data = (await props.axios.get(url)).data
      const text =
        typeof data == "string" ? data : JSON.stringify(data, null, 2)
      downloadFile(filename, text)
      return false
    }

    const deleteRoom = async (room_id: RoomId) => {
      const room_name = props.rooms[room_id].name
      try {
        const s = prompt(
          "「" +
            room_name +
            "」を本当に削除しますか？ 削除すると部屋と関連するポスター，コメントがすべて消去されます。削除する場合は部屋のIDを下記に入力してください。"
        )
        if (s != room_id) {
          return
        }
        const res = await props.axios.delete("/maps/" + room_id)
        console.log(res.data)
        if (res.data.ok) {
          context.emit("delete-room", room_id)
          alert("部屋「" + room_name + "」が削除されました")
        } else {
          alert("部屋の削除に失敗しました")
        }
      } catch (err) {
        alert("部屋の削除に失敗しました")
      }
    }

    const changeRoom = (room_id: RoomId) => {
      context.emit("change-room", room_id)
    }

    const newRoom = () => {
      context.emit("change-room", "new")
    }

    const announceText = ref<HTMLInputElement>()

    const submitAnnouncement = () => {
      const room = props.room?.id
      if (!room) {
        console.error("Room is not selected")
        return
      }
      const d = {
        room,
        marquee: state.announceMarquee,
        text: announceText.value?.value,
        period: state.announceMarqueePeriod,
      }
      console.log("submitAnnouncement", d)
      context.emit("make-announcement", d)
    }

    const askReload = (force: boolean) => {
      if (props.room) {
        context.emit("ask-reload", { room_id: props.room.id, force })
      }
    }

    const createAccessCode = async (room_id: RoomId, code: string) => {
      context.emit("create-access-code", room_id, code)
    }

    const renewAccessCode = async (room_id: RoomId, code: string) => {
      context.emit("renew-access-code", room_id, code)
    }

    const deleteAccessCode = async (room_id: RoomId, code: string) => {
      context.emit("delete-access-code", room_id, code)
    }

    const peopleHavingAccessFiltered = computed(() => {
      const t = state.searchUserText
      if (!t) {
        return state.peopleHavingAccess
      }
      return state.peopleHavingAccess.filter(p => {
        return (
          p.email?.indexOf(t) != -1 ||
          (p["id"]
            ? p.registered?.id.indexOf(t) != -1 ||
              p.registered?.name.indexOf(t) != -1
            : false)
        )
      })
    })

    const checkAllWithAccess = ev => {
      const checked = ev.target.checked
      state.peopleWithAccessAllChecked = checked
      if (!ev.target.indeterminate) {
        for (const p of state.peopleHavingAccess) {
          state.selectedHavingAccess[p.email!] = false
        }
        for (const p of peopleHavingAccessFiltered.value) {
          state.selectedHavingAccess[p.email!] = checked
        }
      }
    }

    const countSelected = computed(() => {
      return Object.values(state.selectedHavingAccess).filter(b => b).length
    })

    const peopleGroups = computed(() => {
      return keyBy(props.room?.people_groups || [], "id")
    })

    const countSelectedGroups = computed(() => {
      return Object.values(state.selectedPeopleGroup).filter(b => b).length
    })

    const allAdmins = computed(() => {
      const peopleInRoomByEmail = keyBy(
        Object.values(state.peopleInRoom),
        "email"
      )
      for (const [email, b] of Object.entries(state.selectedHavingAccess)) {
        if (b && peopleInRoomByEmail[email]?.role == "user") {
          return false
        }
      }
      return true
    })

    const allNonAdmins = computed(() => {
      const peopleInRoomByEmail = keyBy(
        Object.values(state.peopleInRoom),
        "email"
      )
      for (const [email, b] of Object.entries(state.selectedHavingAccess)) {
        if (b && peopleInRoomByEmail[email]?.role == "admin") {
          return false
        }
      }
      return true
    })

    const checkboxAllPeopleGroups = ref<HTMLInputElement>()

    const checkPeopleGroup = (group_id: UserGroupId, ev) => {
      const checked = ev.target.checked
      state.selectedPeopleGroup[group_id] = checked
      checkboxAllPeopleGroups.value!.indeterminate = true
    }

    const checkAllPeopleGroups = ev => {
      const checked = ev.target.checked
      state.peopleGroupAllChecked = checked
      if (!ev.target.indeterminate) {
        for (const gid of props.room?.people_groups || []) {
          state.selectedPeopleGroup[gid.id] = checked
        }
      }
    }

    const getGroupAndUsersSelection = () => {
      const groups = Object.entries(state.selectedPeopleGroup)
        .filter(b => b[1])
        .map(b => b[0])
      const user_emails = Object.entries(state.selectedHavingAccess)
        .filter(b => b[1])
        .map(b => b[0])
      return [groups, user_emails]
    }

    const assignPeopleGroups = async () => {
      const room_id = props.room?.id
      if (!room_id) {
        console.error("Room is not defined")
        return [null, null]
      }
      const [groups, user_emails] = getGroupAndUsersSelection()
      if (!user_emails) {
        return
      }
      for (const email of user_emails) {
        await client.maps
          ._roomId(room_id)
          .people_allowed._email(email)
          .$patch({ body: { add_groups: groups } })
      }
    }

    const unassignPeopleGroups = async () => {
      const room_id = props.room?.id
      if (!room_id) {
        console.error("Room is not defined")
        return [null, null]
      }
      const [groups, user_emails] = getGroupAndUsersSelection()
      if (!user_emails) {
        return
      }
      for (const email of user_emails) {
        await client.maps
          ._roomId(room_id)
          .people_allowed._email(email)
          .$patch({ body: { remove_groups: groups } })
      }
    }

    const checkboxAllPeopleHavingAccess = ref<HTMLInputElement>()

    const checkPersonWithAccess = (email: string, ev) => {
      const checked = ev.target.checked
      console.log("checkPersonWithAccess", email, checked)
      state.selectedHavingAccess[email] = checked
      checkboxAllPeopleHavingAccess.value!.indeterminate = true
    }

    const inputSearchUser = ev => {
      if (!state.searchUserTextComposition) {
        state.searchUserText = ev.target.value
      }
    }

    const removeUser = async () => {
      const room_id = props.room?.id
      if (!room_id) {
        console.error("Room is not defined")
        return
      }
      const user_emails: string[] = []
      for (const p of state.peopleHavingAccess) {
        if (state.selectedHavingAccess[p.email!]) {
          user_emails.push(p.email!)
        }
      }
      if (user_emails.length == 0) {
        return
      }
      if (!confirm("削除して良いですか？取り消せません")) {
        return
      }
      const users_set = new Set(user_emails)
      const peopleInRoomByEmail = keyBy(
        Object.values(state.peopleInRoom),
        "email"
      )
      for (const email of user_emails) {
        const uid = peopleInRoomByEmail[email]?.id as string | undefined
        if (uid) {
          const r = await client.maps
            ._roomId(room_id)
            .people._userId(uid)
            .$delete()
          if (!r.ok) {
            console.error("removeUser() error", r.error)
            users_set.delete(email)
          }
        } else {
          //Only email address stub, not registered user.
          const r = await client.maps
            ._roomId(room_id)
            .people_allowed._email(email)
            .$delete()
          if (!r.ok) {
            console.error("removeUser() error", r.error)
            users_set.delete(email)
          }
        }
      }

      // state.peopleHavingAccess = state.peopleHavingAccess.filter(
      //   p => !users_set.has(p.email)
      // )
      for (const e of users_set) {
        delete state.selectedHavingAccess[e]
      }
    }

    const assignUserEmail = ref<HTMLInputElement>()

    const startAssignUserDialog = async () => {
      state.assignUserDialog = true
      await nextTick(() => {
        assignUserEmail.value?.focus()
      })
    }

    const cancelAssignUserDialog = () => {
      state.assignUserDialog = false
      assignUserEmail.value!.value = ""
    }

    const assignUser = async () => {
      const email = assignUserEmail.value?.value
      if (!email) {
        return
      }
      const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

      const is_email = re.test(email.toLowerCase())
      if (!is_email) {
        if (!confirm("Emailアドレスが正しくないようです。続けますか？")) {
          return
        }
      }
      const r = await client.maps
        ._roomId(props.room!.id)
        .people_allowed.$post({ body: { email } })
      state.assignUserDialog = false
      assignUserEmail.value!.value = ""
      await loadPeopleInMap()
    }

    const assignUserBatch = async () => {
      const people = state.userAssignment
        .filter(u => u.valid)
        .map(u => {
          return { email: u.email, assign_position: false, groups: u.groups }
        })
      const r = await client.maps
        ._roomId(props.room!.id)
        .people_multi.$post({ body: { people } })
      state.assignUserBatchDialog = false
      await loadPeopleInMap()
    }

    const assignRole = async (role: "admin" | "user") => {
      const my_email = localStorage["virtual-poster:email"]
      if (state.selectedHavingAccess[my_email] && role == "user") {
        if (
          !confirm(
            "自分自身を管理者から外すとこのページにアクセスできなくなります。良いですか？"
          )
        ) {
          return
        }
      }
      const peopleInRoomByEmail = keyBy(
        Object.values(state.peopleInRoom),
        "email"
      )
      for (const [email, b] of Object.entries(state.selectedHavingAccess)) {
        const p = peopleInRoomByEmail[email]
        if (b && role == "admin" && p.role != "admin") {
          await client.maps
            ._roomId(props.room!.id)
            .people._userId(p.id)
            .$patch({ body: { role: "admin" } })
        } else if (b && role == "user" && p.role != "user") {
          await client.maps
            ._roomId(props.room!.id)
            .people._userId(p.id)
            .$patch({ body: { role: "user" } })
        }
      }
    }

    const assignUserFile = ref<HTMLInputElement>()

    const startAssignUserBatchDialog = async () => {
      state.assignUserBatchDialog = true
      await nextTick(() => {
        assignUserFile.value?.focus()
      })
    }

    const cancelAssignUserBatchDialog = () => {
      state.userAssignment = []
      state.assignUserBatchDialog = false
    }

    const onUserBatchFileChanged = ev => {
      const file: File = (ev.target.files || ev.dataTransfer.files)[0]
      if (file.type != "text/csv") {
        return
      }
      const reader = new FileReader()
      reader.onload = e => {
        const csv_data = (e.target?.result || undefined) as string | undefined
        if (csv_data) {
          state.userAssignment = []
          const data = Papa.parse(csv_data)
          if (data.data && data.data.length > 0) {
            for (const r of data.data.slice(1) as string[][]) {
              if (r.length == 1 && r[0] == "") {
                continue
              }
              const email: string | undefined = r[0]
              const groups: string[] = r.slice(1).filter(r => r)

              state.userAssignment.push({
                valid: true,
                email,
                groups,
              })
            }
          }
          console.log(data, state.userAssignment)
        }
      }
      reader.readAsText(file)
    }

    const clearMapCache = async () => {
      const room_id = props.room?.id
      if (!room_id) {
        console.error("Room ID is undefined")
        return
      }
      const r = await client.maps._roomId(room_id).reset_cache.$post()
      if (r.ok) {
        alert("キャッシュをクリアしました")
      } else {
        alert("キャッシュをクリアできませんでした")
      }
    }

    watch(
      () => props.socket,
      () => {
        if (props.socket) {
          props.socket.on("Poster", async (p: Poster) => {
            if (p.file_url == "not_disclosed") {
              p.file_url =
                (await client.posters._posterId(p.id).file_url.$get()).url ||
                p.file_url
            }
            if (p.file_url) {
              p.file_url += "?timestamp=" + p.last_updated
            }
            state.postersInRoom[p.id] = p
          })

          props.socket.on("PosterRemove", (pid: PosterId) => {
            delete state.postersInRoom[pid]
          })
        }
      }
    )

    watch(
      () => [
        state.roomConfig.allowPosterAssignment,
        state.roomConfig.hideUnvisited,
      ],
      async (nv, ov) => {
        const room = props.room
        if (!room) {
          console.error("Room is not defined")
          return
        }
        if (ov[0] == undefined && ov[0] == undefined) {
          // Initial
          return
        }

        const rules: AccessRule[] = [{ email: "*", allow: false }]
        const r = await client.maps._roomId(room.id).$patch({
          body: {
            allow_poster_assignment: state.roomConfig.allowPosterAssignment,
            minimap_visibility: state.roomConfig.hideUnvisited
              ? "all_only_visited"
              : "all_initial",
          },
        })
      }
    )

    watch(
      () => props.room,
      async () => {
        const room = props.room
        if (room) {
          await loadRoom(room)
        }
      },
      { deep: true }
    )

    const onChangeCodeActive = async (code: string, ev) => {
      const room = props.room
      if (!room) {
        return
      }
      const active = ev.target.checked
      await client.maps
        ._roomId(room.id)
        .access_code._accessCode(code)
        .$patch({ body: { active } })
    }

    const accessCodeUrl = (code?: string) => {
      if (code) {
        return new URL(location.href).origin + "/?code=" + code
      } else {
        return undefined
      }
    }

    const hoverCell = () => {
      //
    }

    const selectMapCell = () => {
      //
    }

    const mapPatchJsonTextArea = ref<HTMLTextAreaElement>()

    const inputMapChangeMessage = ref<HTMLInputElement>()

    const onInputPatch = ev => {
      state.inputPatchText = ev.target.value
    }

    const verifyInputPatch = (s: string) => {
      try {
        const arr = JSON.parse(s || "[]")
        return !!verifyMapUpdateEntries(arr)
      } catch (err) {
        console.error("verifyInputPatch", err)
        return false
      }
    }

    const submitMapCellPatch = async () => {
      const room_id = props.room?.id
      const message = inputMapChangeMessage.value?.value
      const csv_str = state.replaceMapData
      const s = mapPatchJsonTextArea.value?.value
      if (!room_id) {
        return
      }
      let r: { ok: boolean } | undefined = undefined
      if (csv_str) {
        r = await client.maps._roomId(room_id).cells.$put({
          body: {
            data: csv_str,
            message: inputMapChangeMessage.value?.value,
          },
        })
      } else if (s) {
        let changes: MapUpdateEntry[] = []
        try {
          changes = JSON.parse(s)
        } catch (err) {
          console.error("JSON parse error")
        }
        if (changes.length > 0) {
          r = await client.maps._roomId(room_id).cells.$patch({
            body: { changes: (changes as unknown) as string[], message },
          })
        }
      }
      if (!r) {
        return
      } else if (r.ok) {
        await loadMapCells(room_id)
        context.emit("reload-rooms")
        alert("マップを差し替えました。")
      } else {
        alert(
          "マップの差し替えができませんでした（ポスター板の位置を変えようとしたなど）。"
        )
      }
    }
    const onDropReplaceMap = async (event: any) => {
      const room_id = props.room?.id
      if (!room_id) {
        return
      }
      state.dragoverMapReplace = false
      const client = api(axiosClient(axios))
      const fileList: File[] = event.target.files
        ? event.target.files
        : event.dataTransfer.files
      if (fileList.length == 0) {
        return false
      }
      const files: File[] = []
      for (let i = 0; i < fileList.length; i++) {
        files.push(fileList[i])
      }
      console.log(files)

      const file = files[0]
      if (!file) {
        console.error("File not found")
      } else if (file.type != "text/csv") {
        console.error("File type invalid")
        alert("ファイルはCSVファイルのみです")
      } else if (file.size >= 10e6) {
        alert("ファイルが10 MB以下にしてください")
      } else {
        const fileReader = new FileReader()
        fileReader.onload = async event => {
          const csv_str = event.target!.result as string
          state.replaceMapData = csv_str
        }
        fileReader.readAsText(file)
      }
    }

    const inputCodeAccess = ref<HTMLInputElement>()

    const startEditingCodeRights = async (access_code: {
      code: string
      access_granted: string[]
    }) => {
      state.editingCodeAccess = access_code.code
      await nextTick(() => {
        inputCodeAccess.value!.value = access_code.access_granted.join(";;")
      })
    }

    const finishEditingCodeRights = async () => {
      const code = state.editingCodeAccess
      const room_id = props.room?.id
      const granted_str = inputCodeAccess.value!.value
      const access_granted = granted_str.split(";;")
      if (code && granted_str != undefined && room_id) {
        const r = await client.maps
          ._roomId(room_id)
          .access_code._accessCode(code)
          .$patch({ body: { access_granted } })
        if (r.ok) {
          context.emit("reload-room-metadata", room_id)
        }
      }
      state.editingCodeAccess = undefined
    }

    return {
      ...toRefs(state),
      deleteRoom,
      onFileChange,
      downloadUrl,
      downloadFile,
      submitClick,
      changeRoom,
      newRoom,
      chatGroupsSorted,
      announceText,
      submitAnnouncement,
      askReload,
      createAccessCode,
      renewAccessCode,
      deleteAccessCode,
      checkAllPeopleGroups,
      checkboxAllPeopleGroups,
      checkPeopleGroup,
      countSelectedGroups,
      assignPeopleGroups,
      unassignPeopleGroups,
      checkAllWithAccess,
      checkPersonWithAccess,
      checkboxAllPeopleHavingAccess,
      inputSearchUser,
      peopleHavingAccessFiltered,
      countSelected,
      removeUser,
      assignUserEmail,
      startAssignUserDialog,
      cancelAssignUserDialog,
      assignUser,
      startAssignUserBatchDialog,
      cancelAssignUserBatchDialog,
      assignUserFile,
      onUserBatchFileChanged,
      assignUserBatch,
      clearMapCache,
      onChangeCodeActive,
      accessCodeUrl,
      hoverCell,
      selectMapCell,
      lang,
      allAdmins,
      allNonAdmins,
      assignRole,
      mapPatchJsonTextArea,
      onInputPatch,
      submitMapCellPatch,
      onDropReplaceMap,
      inputMapChangeMessage,
      verifyInputPatch,
      inputCodeAccess,
      startEditingCodeRights,
      finishEditingCodeRights,
      peopleGroups,
    }
  },
})
</script>

<style lang="css">
.tab-content section {
  border: 1px solid #ccc;
  border-radius: 3px;
  margin: 10px 0px;
  padding: 10px;
}

#room-list td:nth-child(1) {
  font-weight: bold;
  width: 50px;
}

#room-list td:nth-child(2) {
  width: 150px;
}

div.table-column-tool {
  float: right;
}

.room-id {
  /* word-break: break-all; */
}

#room-nav a {
  font-size: 14px;
  margin: 0px 5px;
}
#room-nav a.active {
  color: black;
  font-weight: bold;
  cursor: default;
}

span.access-code {
  display: inline-block;
  width: 250px;
}

#user-list-tools {
  margin: 10px 0px;
}
#user-list-tools button {
  margin: 0px 5px;
}

#search-user {
  font-size: 18px;
}

.chat-user {
  margin-right: 10px;
}

#chat-groups:nth-child(1) {
  width: 100px;
}
#chat-groups:nth-child(2) {
  width: 100px;
}

.access-code-url {
  width: 400px;
  height: 30px;
  font-size: 14px;
}

#user-table tr.bold td {
  font-weight: bold;
}

#drop-replace-map {
  width: 150px;
  height: 100%;
  padding: 70px 10px;
  background: #ccc;
}
#drop-replace-map.dragover {
  background: rgb(156, 191, 156);
}

#input-patch {
  width: 100%;
  height: 100%;
}

#input-mapchange-message {
  width: 200px;
  height: 30px;
}

.access-code-entry {
  margin: 5px 0px;
  padding: 5px;
  border: 1px solid #ccc;
  border-radius: 3px;
}

.code-right-entry {
  display: inline-block;
  padding: 4px;
  height: 30px;
  background: #ccc;
  border-radius: 3px;
  margin: 0px 5px 0px 0px;
}

.code-right-entry.valid {
  background: rgb(166, 215, 166);
}
</style>
