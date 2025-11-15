export const themeManager  = async () => {
    /*
    use in OBR.ready
    sets data-therme on the body-tag   */
    const setTheme = (theme) => {
        console.log(theme)
        document.body.setAttribute('data-theme',theme.mode);
    }
    let theme = await OBR.theme.getTheme();
    setTheme(theme)
    OBR.theme.onChange((theme) => {
    setTheme(theme)
})
}