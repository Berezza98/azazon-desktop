<template>
  <div id="wrapper">
    <el-row>
      <el-col :span="24" class="box">
        <el-input placeholder="Please input" v-model="url">
          <template slot="prepend">http://</template>
        </el-input>
      </el-col>
    </el-row>
    <el-row :gutter="10" class="box">
      <el-col :span="12">
        <el-button class="full-width" type="primary" @click="getData()" :loading="loading">Get data</el-button>
      </el-col>
      <el-col :span="12">
        <el-button class="full-width" type="warning" :disabled="!loading">Cancel</el-button>
      </el-col>
    </el-row>
    <el-row class="box" v-if="!loading">
      <el-col :span="24">
        <el-checkbox v-model="showAdv">Show advanced options</el-checkbox>
      </el-col>
    </el-row>
    <el-row v-if="showAdv && !loading" class="middle box">
      <el-col :span="12">
        <el-switch
          v-model="getFullInfo"
          active-text="Get full information"
          inactive-text="Get only asins">
        </el-switch>
      </el-col>
      <el-col :span="12">
        <el-input
          placeholder="ZIP code"
          v-model="zip"
          clearable>
        </el-input>
      </el-col>
    </el-row>
    <el-row>
      <!-- <el-card v-for="(element, index) in elements" :key="index" shadow="hover" class="item">
        {{ element.data.asin }}
      </el-card> -->
      <el-table :data="elements" empty-text="No data to show" highlight-current-row style="width: 100%">
        <el-table-column prop="data.name" v-if="getFullInfo" label="Name"></el-table-column>
        <el-table-column prop="data.asin" label="ASIN"></el-table-column>
        <el-table-column prop="data.rank" v-if="getFullInfo" label="Rank"></el-table-column>
      </el-table>
    </el-row>
  </div>
</template>

<script>

  import Amazon from './amazon';

  export default {
    components: { },
    data () {
      return {
        url : 'https://www.amazon.com/s?i=merchant-items&me=A2H9CW548IGR3J&qid=1550007143&ref=sr_pg_1',
        loading : false,
        elements : [],
        showAdv : false,
        getFullInfo : false,
        zip : ""
      }
    },
    methods: {
      async getData () {
        this.elements = [];
        this.loading = true;
        let myAmazon = new Amazon(this.url, this.zip);
        myAmazon.on('data', data => {
          let parsedData = JSON.parse(data);
          if (parsedData.data.last) {
            this.loading = false;
          } else {
            this.elements = [...this.elements, parsedData];
          }
        })
        await myAmazon.open();
        await myAmazon.changeLocation();
        if (this.getFullInfo) {
          await myAmazon.getGoodsInfo();
        } else {
          await myAmazon.getOnlyAsins();
        }

      }
    }
  }
</script>

<style>
  @import url('https://fonts.googleapis.com/css?family=Source+Sans+Pro');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body { font-family: 'Source Sans Pro', sans-serif; }

  #wrapper {
    max-width: 960px;
    margin: 0 auto;
    padding: 20px 0px;
  }

  .box {
    margin-bottom: 10px;
  }

  .full-width {
    width: 100%;
  }

  .column {
    display: flex;
    flex-direction: column;
  }

  .middle {
    display: flex;
    align-items: center;
  }

  .item {
    margin-bottom: 10px;
  }
</style>
