## DEV

Local development
* Install Beyond20 browser extension
* Whitelist https://www.owlbear.com/* in Beyond20 browser extension
* Install Owl20 browser extension
* `npm run dev`
* add http://localhost:5173/manifest.json as an owlbear extension.

### Control
```mermaid
graph TD
    beyond20[Beyond20 browser-ext]-->dndbeyond.com
    beyond20-->owlbear.com
    owl20[⭐Owl20 browser-ext]-->owlbear.com
    owl20-->owl20-owlbear

    subgraph owlbear.com
        subgraph iframe[iframe Sandbox]
            owl20-owlbear[ℹ️owl20-owlbear]
        end    
    end
```

### Data Flow
```mermaid
graph TD
  mouse-click-->beyond20-internal-event-->DOM-event-->Transform-->window.postMessage-->OBR.broadcast-->Display


    subgraph owlbear.com
        DOM-event
 subgraph iframe-sandbox[iframe Sandbox]

        subgraph owl20-owlbear[ℹ️owl20-owlbear]

            window.postMessage
            OBR.broadcast
            Display[Display to all members in the room]
        end    
    end    
end
    subgraph dndbeyond.com
        mouse-click
    end    

    subgraph beyond20[Beyond20 browser-ext]
        beyond20-internal-event
    end   

    subgraph owl20[⭐Owl20 Browser-ext]
        Transform[Copy DOM event to window.PostMessage]
    end    

```
