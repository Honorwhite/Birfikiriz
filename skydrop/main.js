const CHUNK_SIZE = 16384;
let incomingFileData = {};
let outgoingFileData = {};
let mqttClient;
let mqttTopic;
let peer;
let myId;
let myName;
let networkId;
let peersInRoom = new Map();

const elements = {
    statusBadge: document.getElementById('status'),
    peerGrid: document.getElementById('discovery'),
    localName: document.getElementById('local-peer-name'),
    btnRefresh: document.getElementById('btn-refresh'),
    emptyState: document.getElementById('empty-state'),
    modal: document.getElementById('modal-container'),
    modalMsg: document.getElementById('modal-message'),
    btnAccept: document.getElementById('btn-accept'),
    btnDecline: document.getElementById('btn-decline'),
    progressOverlay: document.getElementById('progress-container'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text')
};

async function init() {
    myId = Utils.generateId();
    myName = Utils.getDeviceName();
    networkId = await Utils.getNetworkHash();

    elements.localName.textContent = `${myName} (Me)`;

    // MQTT Initialization (EMQX Public Broker)
    mqttTopic = `skydrop/v1/${networkId}`;
    mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    mqttClient.on('connect', () => {
        console.log('MQTT Connected');
        mqttClient.subscribe(mqttTopic);
        announcePresence();
    });

    mqttClient.on('message', (topic, message) => {
        if (topic === mqttTopic) {
            handleDiscoveryMessage(JSON.parse(message.toString()));
        }
    });

    // Robust PeerJS configuration
    peer = new Peer(`${networkId}-${myId}`, {
        debug: 1,
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    peer.on('open', () => {
        elements.statusBadge.textContent = 'Online';
        elements.statusBadge.classList.add('online');
    });

    peer.on('connection', (conn) => {
        handleConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err.type);
        elements.statusBadge.textContent = 'Status: ' + err.type;
    });

    elements.btnRefresh.onclick = () => {
        peersInRoom.clear();
        updatePeerList();
        announcePresence();
    };

    // Heartbeat every 5s
    setInterval(announcePresence, 5000);

    // Periodic Cleanup of stale peers
    setInterval(cleanupPeers, 10000);
}

function announcePresence() {
    if (mqttClient && mqttClient.connected) {
        const presence = JSON.stringify({
            id: peer.id,
            name: myName,
            type: 'presence',
            lastSeen: Date.now()
        });
        mqttClient.publish(mqttTopic, presence);
    }
}

function handleDiscoveryMessage(data) {
    if (!data || data.id === peer.id) return;

    if (data.type === 'presence') {
        peersInRoom.set(data.id, {
            id: data.id,
            name: data.name,
            lastSeen: data.lastSeen
        });
        updatePeerList();
    }
}

function cleanupPeers() {
    const now = Date.now();
    let changed = false;
    for (const [id, peerInfo] of peersInRoom) {
        if (now - peerInfo.lastSeen > 20000) {
            peersInRoom.delete(id);
            changed = true;
        }
    }
    if (changed) updatePeerList();
}

function updatePeerList() {
    const peerList = Array.from(peersInRoom.values());

    if (peerList.length > 0) {
        elements.emptyState.classList.add('hidden');
    } else {
        elements.emptyState.classList.remove('hidden');
    }

    const currentCards = elements.peerGrid.querySelectorAll('.peer-card');
    currentCards.forEach(c => c.remove());

    peerList.forEach(peerInfo => {
        const card = document.createElement('div');
        card.className = 'peer-card';
        card.innerHTML = `
            <div class="peer-icon-wrapper">
                <i data-lucide="${getIconForDevice(peerInfo.name)}"></i>
            </div>
            <span class="peer-name">${peerInfo.name}</span>
            <input type="file" style="display:none">
        `;

        card.onclick = () => {
            const fileInput = card.querySelector('input');
            fileInput.click();
            fileInput.onchange = (ev) => {
                if (ev.target.files.length > 0) {
                    sendFileOffer(peerInfo.id, ev.target.files[0]);
                }
            };
        };

        elements.peerGrid.appendChild(card);
    });
    lucide.createIcons();
}

function getIconForDevice(name) {
    if (name.includes('PC') || name.includes('Windows') || name.includes('System')) return 'monitor';
    if (name.includes('Android') || name.includes('iOS') || name.includes('Phone')) return 'smartphone';
    if (name.includes('MacBook')) return 'laptop';
    return 'user';
}

function sendFileOffer(targetId, file) {
    showProgress('Connecting...');
    const conn = peer.connect(targetId, { reliable: true });

    const timeout = setTimeout(() => {
        if (!conn.open) {
            hideProgress();
            alert('Connection timeout. Peer might be offline.');
        }
    }, 15000);

    conn.on('open', () => {
        clearTimeout(timeout);
        outgoingFileData[conn.peer] = {
            file,
            chunksSent: 0,
            totalChunks: Math.ceil(file.size / CHUNK_SIZE)
        };

        conn.send({
            type: 'file-offer',
            fileName: file.name,
            fileSize: file.size,
            senderName: myName
        });

        handleConnection(conn);
    });
}

function handleConnection(conn) {
    conn.on('data', (data) => {
        if (data.type === 'file-offer') {
            showAcceptModal(data, conn);
        } else if (data.type === 'file-accepted') {
            startFileTransfer(conn);
        } else if (data.type === 'file-chunk') {
            receiveChunk(data, conn);
        }
    });

    conn.on('close', () => {
        delete outgoingFileData[conn.peer];
        delete incomingFileData[conn.peer];
    });
}

async function startFileTransfer(conn) {
    const info = outgoingFileData[conn.peer];
    if (!info) return;

    showProgress('Sending File...');

    try {
        for (let i = 0; i < info.totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, info.file.size);
            const chunk = info.file.slice(start, end);
            const buffer = await chunk.arrayBuffer();

            conn.send({
                type: 'file-chunk',
                chunk: buffer,
                index: i,
                total: info.totalChunks,
                fileName: info.file.name
            });

            const percent = Math.round(((i + 1) / info.totalChunks) * 100);
            updateProgressBar(percent);

            // Flow control
            if (i % 100 === 0) await new Promise(r => setTimeout(r, 5));
        }

        setTimeout(() => {
            hideProgress();
            alert('File sent successfully!');
        }, 1000);
    } catch (e) {
        console.error('Transfer failed', e);
        hideProgress();
        alert('Transfer failed.');
    }
}

function receiveChunk(data, conn) {
    if (!incomingFileData[conn.peer]) {
        incomingFileData[conn.peer] = {
            chunks: [],
            received: 0,
            total: data.total,
            fileName: data.fileName
        };
        showProgress('Receiving...');
    }

    const info = incomingFileData[conn.peer];
    info.chunks[data.index] = data.chunk;
    info.received++;

    const percent = Math.round((info.received / info.total) * 100);
    updateProgressBar(percent);

    if (info.received === info.total) {
        setTimeout(() => {
            completeDownload(info);
            delete incomingFileData[conn.peer];
            hideProgress();
        }, 1000);
    }
}

function completeDownload(info) {
    const blob = new Blob(info.chunks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = info.fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 2000);
}

function showProgress(title) {
    const progTitle = document.getElementById('progress-title');
    progTitle.textContent = title;
    elements.progressOverlay.classList.remove('hidden');
}

function hideProgress() {
    elements.progressOverlay.classList.add('hidden');
    elements.progressBar.style.width = '0%';
    elements.progressText.textContent = '0%';
}

function updateProgressBar(percent) {
    elements.progressBar.style.width = percent + '%';
    elements.progressText.textContent = percent + '%';
}

function showAcceptModal(data, conn) {
    elements.modalMsg.textContent = `${data.senderName} wants to send "${data.fileName}" (${Utils.formatBytes(data.fileSize)})`;
    elements.modal.classList.remove('hidden');

    elements.btnAccept.onclick = () => {
        elements.modal.classList.add('hidden');
        conn.send({ type: 'file-accepted' });
    };

    elements.btnDecline.onclick = () => {
        elements.modal.classList.add('hidden');
        conn.send({ type: 'file-declined' });
    };
}

init();
