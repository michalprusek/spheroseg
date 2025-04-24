# ResUnet.py

import torch
import torch.nn as nn
import torchvision.transforms.functional as TF


# ===========================
# Squeeze-and-Excitation Block
# ===========================
class SEBlock(nn.Module):
    """
    Squeeze-and-Excitation (SE) Block for channel-wise attention.
    """

    def __init__(self, in_channels, reduction=16):
        super(SEBlock, self).__init__()
        self.global_avg_pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(in_channels, in_channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(in_channels // reduction, in_channels, bias=False),
            nn.Sigmoid(),
        )

    def forward(self, x):
        b, c, _, _ = x.size()
        y = self.global_avg_pool(x).view(b, c)
        y = self.fc(y).view(b, c, 1, 1)
        return x * y


# ===========================
# Attention Gate
# ===========================
class AttentionGate(nn.Module):
    """
    Attention Gate to focus on relevant features in skip connections.
    """

    def __init__(self, F_g, F_l, F_int):
        super(AttentionGate, self).__init__()
        self.W_g = nn.Sequential(
            nn.Conv2d(F_g, F_int, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm2d(F_int)
        )

        self.W_x = nn.Sequential(
            nn.Conv2d(F_l, F_int, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm2d(F_int)
        )

        self.psi = nn.Sequential(
            nn.Conv2d(F_int, 1, kernel_size=1, stride=1, padding=0, bias=True),
            nn.BatchNorm2d(1),
            nn.Sigmoid()
        )

        self.relu = nn.ReLU(inplace=True)

    def forward(self, g, x):
        """
        Args:
            g: Gating signal from the decoder (higher level features).
            x: Skip connection features from the encoder.
        """
        g1 = self.W_g(g)
        x1 = self.W_x(x)
        psi = self.relu(g1 + x1)
        psi = self.psi(psi)
        return x * psi


# ===========================
# Residual Block
# ===========================
class ResidualBlock(nn.Module):
    def __init__(self, in_channels, out_channels, dilation=1, reduction=16, dropout=0.1):
        super(ResidualBlock, self).__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=dilation, dilation=dilation,
                               bias=False)
        self.gn1 = nn.GroupNorm(num_groups=32, num_channels=out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.dropout = nn.Dropout(p=dropout)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=dilation, dilation=dilation,
                               bias=False)
        self.gn2 = nn.GroupNorm(num_groups=32, num_channels=out_channels)

        # Adjust residual connection if input and output channels differ
        self.adjust_channels = nn.Conv2d(in_channels, out_channels, kernel_size=1, padding=0,
                                         bias=False) if in_channels != out_channels else None

        self.se = SEBlock(out_channels, reduction)

    def forward(self, x):
        residual = x
        if self.adjust_channels:
            residual = self.adjust_channels(x)

        out = self.conv1(x)
        out = self.gn1(out)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.conv2(out)
        out = self.gn2(out)

        out += residual
        out = self.relu(out)
        out = self.se(out)
        return out


# ===========================
# Enhanced ResUNet with Attention Gates
# ===========================
class ResUNet(nn.Module):
    def __init__(self, in_channels=3, out_channels=1, features=[64, 128, 256, 512, 1024]):
        super(ResUNet, self).__init__()
        self.ups = nn.ModuleList()
        self.downs = nn.ModuleList()
        self.attentions = nn.ModuleList()
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)

        # Down part of ResUNet
        for feature in features:
            self.downs.append(ResidualBlock(in_channels, feature))
            in_channels = feature

        # Bottleneck
        self.bottleneck = ResidualBlock(features[-1], features[-1] * 2)

        # Up part of ResUNet
        for feature in reversed(features):
            self.ups.append(nn.ConvTranspose2d(feature * 2, feature, kernel_size=2, stride=2))
            self.ups.append(ResidualBlock(feature * 2, feature))
            self.attentions.append(AttentionGate(F_g=feature, F_l=feature, F_int=feature // 2))

        self.final_conv = nn.Conv2d(features[0], out_channels, kernel_size=1)

    def forward(self, x):
        skip_connections = []

        for down in self.downs:
            x = down(x)
            skip_connections.append(x)
            x = self.pool(x)

        x = self.bottleneck(x)
        skip_connections = skip_connections[::-1]

        for idx in range(0, len(self.ups), 2):
            x = self.ups[idx](x)
            skip_connection = skip_connections[idx // 2]

            # Apply attention gate
            attention = self.attentions[idx // 2](g=x, x=skip_connection)
            concat_skip = torch.cat((attention, x), dim=1)
            x = self.ups[idx + 1](concat_skip)

        x = self.final_conv(x)
        return x
