/**
 * Room EQ - Visual Pipeline Editor
 * MVP 1: Read-only multi-lane visualizer with wires
 */

let DSP;
let selectedNode = undefined;
let lanes = [];

const nodeWidth = 120;
const nodeHeight = 80;
const nodeSpacing = 20;
const laneHeight = 120;

/**
 * Initialize the Room EQ page
 */
export async function roomOnLoad() {
    console.log('Room EQ: Initializing...');
    
    // Get DSP instance from parent
    DSP = window.parent.DSP;
    
    if (!DSP || !DSP.connected) {
        showError('Not connected to DSP. Please connect from the Connections page.');
        return;
    }
    
    try {
        await DSP.downloadConfig();
        await renderPipeline();
        console.log('Room EQ: Initialized successfully');
    } catch (error) {
        console.error('Room EQ: Initialization error', error);
        showError('Error loading DSP configuration: ' + error.message);
    }
}

/**
 * Render the complete pipeline with lanes
 */
async function renderPipeline() {
    const editor = document.getElementById('editor');
    if (!editor) {
        console.error('Room EQ: Editor element not found');
        return;
    }
    
    editor.innerHTML = '';
    lanes = [];
    
    // Get linearized channel data
    const channels = await DSP.linearizeConfig();
    const channelCount = channels.length;
    
    console.log(`Room EQ: Rendering ${channelCount} channels`);
    
    // Create lanes
    for (let channelNo = 0; channelNo < channelCount; channelNo++) {
        const lane = createLane(channelNo, channels[channelNo]);
        editor.appendChild(lane);
        lanes.push(lane);
    }
}

/**
 * Create a single lane (channel row)
 */
function createLane(channelNo, components) {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.setAttribute('data-channel', channelNo);
    lane.style.height = laneHeight + 'px';
    
    // Lane label
    const label = document.createElement('div');
    label.className = 'laneLabel';
    label.textContent = `Channel ${channelNo}`;
    lane.appendChild(label);
    
    // Container for nodes
    const nodeContainer = document.createElement('div');
    nodeContainer.className = 'nodeContainer';
    lane.appendChild(nodeContainer);
    
    // Create nodes for each component
    let xPos = 10;
    const nodes = [];
    
    for (let i = 0; i < components.length; i++) {
        const component = components[i];
        const node = createNode(component, channelNo, xPos);
        nodeContainer.appendChild(node);
        nodes.push(node);
        xPos += nodeWidth + nodeSpacing;
    }
    
    // Draw wires between consecutive nodes
    requestAnimationFrame(() => {
        drawWires(nodeContainer, nodes);
    });
    
    return lane;
}

/**
 * Create a node element for a component
 */
function createNode(component, channelNo, xPos) {
    const node = document.createElement('div');
    node.className = 'node';
    node.setAttribute('data-type', component.type);
    node.setAttribute('data-channel', channelNo);
    node.style.left = xPos + 'px';
    node.style.width = nodeWidth + 'px';
    node.style.height = nodeHeight + 'px';
    
    // Node header
    const header = document.createElement('div');
    header.className = 'nodeHeader';
    header.textContent = component.type.toUpperCase();
    node.appendChild(header);
    
    // Node content
    const content = document.createElement('div');
    content.className = 'nodeContent';
    content.innerHTML = formatNodeContent(component);
    node.appendChild(content);
    
    // Add connectors
    if (component.type !== 'input') {
        const connectorLeft = document.createElement('div');
        connectorLeft.className = 'connector left';
        node.appendChild(connectorLeft);
    }
    
    if (component.type !== 'output') {
        const connectorRight = document.createElement('div');
        connectorRight.className = 'connector right';
        node.appendChild(connectorRight);
    }
    
    return node;
}

/**
 * Format node content based on component type
 */
function formatNodeContent(component) {
    switch (component.type) {
        case 'input':
        case 'output':
            return `
                <div class="nodeDetail">${component.device.device}</div>
                <div class="nodeDetail small">${component.device.format}</div>
            `;
        
        case 'mixer':
            const sourceCount = component.sources.length;
            return `
                <div class="nodeDetail">${sourceCount} source${sourceCount !== 1 ? 's' : ''}</div>
            `;
        
        case 'filter':
            const filterName = Object.keys(component).find(k => k !== 'type');
            if (!filterName) return '<div class="nodeDetail">Unknown</div>';
            
            const filter = component[filterName];
            const params = filter.parameters;
            
            if (filter.type === 'Biquad') {
                let details = `<div class="nodeDetail">${filterName}</div>`;
                details += `<div class="nodeDetail small">${params.type}</div>`;
                if (params.freq) details += `<div class="nodeDetail small">${params.freq} Hz</div>`;
                if (params.gain !== undefined) details += `<div class="nodeDetail small">${params.gain} dB</div>`;
                return details;
            } else if (filter.type === 'Gain') {
                return `
                    <div class="nodeDetail">${filterName}</div>
                    <div class="nodeDetail small">Gain: ${params.gain} dB</div>
                `;
            } else if (filter.type === 'Conv') {
                return `
                    <div class="nodeDetail">${filterName}</div>
                    <div class="nodeDetail small">Convolution</div>
                `;
            } else {
                return `
                    <div class="nodeDetail">${filterName}</div>
                    <div class="nodeDetail small">${filter.type}</div>
                `;
            }
        
        default:
            return '<div class="nodeDetail">Unknown</div>';
    }
}

/**
 * Draw wires between consecutive nodes
 */
function drawWires(container, nodes) {
    // Remove existing wires
    const existingWires = container.querySelectorAll('.wire');
    existingWires.forEach(wire => wire.remove());
    
    // Draw wire between each consecutive pair
    for (let i = 0; i < nodes.length - 1; i++) {
        const fromNode = nodes[i];
        const toNode = nodes[i + 1];
        
        const wire = createWire(fromNode, toNode);
        container.appendChild(wire);
    }
}

/**
 * Create a wire (connection line) between two nodes
 */
function createWire(fromNode, toNode) {
    const wire = document.createElement('div');
    wire.className = 'wire';
    
    // Get connector positions
    const fromRect = fromNode.getBoundingClientRect();
    const toRect = toNode.getBoundingClientRect();
    const containerRect = fromNode.parentElement.getBoundingClientRect();
    
    // Calculate positions relative to container
    const fromX = fromRect.right - containerRect.left;
    const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
    const toX = toRect.left - containerRect.left;
    const toY = toRect.top + toRect.height / 2 - containerRect.top;
    
    // Calculate wire geometry
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    
    // Position and style the wire
    wire.style.left = fromX + 'px';
    wire.style.top = fromY + 'px';
    wire.style.width = length + 'px';
    wire.style.transform = `rotate(${angle}deg)`;
    
    return wire;
}

/**
 * Show an error message to the user
 */
function showError(message) {
    const editor = document.getElementById('editor');
    if (editor) {
        editor.innerHTML = `
            <div class="error">
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

/**
 * Refresh the pipeline view (for future use)
 */
export async function refreshPipeline() {
    await DSP.downloadConfig();
    await renderPipeline();
}
