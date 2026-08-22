Component({
  properties: {
    active: { type: String, value: "home" }
  },
  methods: {
    go(event) {
      const page = event.currentTarget.dataset.page;
      const routes = {
        home: "/pages/index/index",
        bases: "/pages/bases/bases",
        favorites: "/pages/favorites/favorites"
      };
      if (!routes[page] || page === this.data.active) return;
      wx.redirectTo({
        url: routes[page],
        fail: () => wx.reLaunch({ url: routes[page] })
      });
    }
  }
});
